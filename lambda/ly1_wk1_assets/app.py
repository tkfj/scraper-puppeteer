import json
import boto3
from urllib.parse import unquote
import awswrangler as wr
import pandas as pd
import pyarrow as pa
from uuid import uuid4
import io
import os

def lambda_handler(event, context):
    DST_DB      = os.getenv("DST_DB")      or "scrpu_ly1"
    DST_TABLE   = os.getenv("DST_TABLE")   or "wk1_assets"
    WORKGROUP   = os.getenv("WORKGROUP")   or "wg_scrpu_dev"
    ICEBERG_STAGE = f"s3://scrpu-dev-dwh/tmp_iceberg_stage/{uuid4()}/"

    bucket = unquote(event["bucket"])
    key = unquote(event['key'])
    print(f'${bucket=} ${key=}')
    s3_client = boto3.client("s3")
    resp = s3_client.get_object(Bucket=bucket, Key=key)
    metadata = resp["Metadata"]
    s_asof=metadata["asof"]
    s_ingest=metadata["ingest"]

    # read src
    df = pd.read_csv(
        io.BytesIO(resp["Body"].read()),
        encoding="cp932",
        quotechar='"',
        dtype=str,
    )
    df.info()

    # rename column
    df=df.rename(columns={
        "日付":"dt_raw",
    })

    # melt
    df = df.melt(id_vars=["dt_raw"], var_name="category_raw", value_name="amount_raw")

    # add column
    df["asof"] = s_asof
    df["ingest"] = s_ingest
    # df["dt"] = df["dt_raw"].str.replace("/","")
    df["asof_ts"] = pd.to_datetime(s_asof, format="%Y%m%d", errors='coerce')
    df["ingest_ts"] = pd.to_datetime(s_ingest, format="%Y%m%d_%H%M%S_%f", errors='coerce').floor("ms")
    # df["dt_ts"] = pd.to_datetime(df["dt_raw"], format="%Y/%m/%d", errors='coerce')

    # select column
    df = df.reindex(columns=['asof', 'asof_ts', 'ingest', 'ingest_ts', 'dt_raw', 'category_raw', 'amount_raw'])
    df.info()

    # delete dst partition
    qid = wr.athena.start_query_execution(
        sql=f"DELETE FROM {DST_DB}.{DST_TABLE} WHERE asof='{s_asof}' and ingest='{s_ingest}'",
        workgroup=WORKGROUP,
    )
    wr.athena.wait_query(query_execution_id=qid)

    # write dst
    if not df.empty:
        wr.athena.to_iceberg(
            df=df,
            database=DST_DB,
            table=DST_TABLE,
            workgroup=WORKGROUP,
            temp_path=ICEBERG_STAGE,
        )

    respbody = {
        "asof":s_asof,
        "ingest":s_ingest,
    }
    return respbody

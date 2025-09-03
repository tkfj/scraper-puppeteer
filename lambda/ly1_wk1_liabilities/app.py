import json
import os
import boto3
from urllib.parse import unquote
import awswrangler as wr
import pandas as pd
import pyarrow as pa
from uuid import uuid4

def get_ttl(data):
    s_ttl_raw_raw=data["total_amount"]
    s_ttl_raw=(s_ttl_raw_raw.split("：")[-1]).strip()
    s_ttl=s_ttl_raw.rstrip("円").replace(",","").strip()
    row={
        "category": "合計",
        "amount_raw": s_ttl_raw,
        "amount": s_ttl,
    }
    return row

def get_breakdown(data):
    s_category=data["t"]
    s_amount_raw=data["v"]
    s_amount=s_amount_raw.rstrip("円").replace(",", "").strip()
    row={
        "category": s_category,
        "amount_raw": s_amount_raw,
        "amount": s_amount,
    }
    return row


def lambda_handler(event, context):
    DST_DB      = os.getenv("DST_DB")      or "scrpu_ly1"
    DST_TABLE   = os.getenv("DST_TABLE")   or "wk1_liabilities_breakdown"
    WORKGROUP   = os.getenv("WORKGROUP")   or "wg_scrpu_dev"
    ICEBERG_STAGE = f"s3://scrpu-dev-dwh/tmp_iceberg_stage/{uuid4()}/"

    # read src
    bucket = unquote(event["bucket"])
    key = unquote(event['key'])
    print(f'${bucket=} ${key=}')
    s3_client = boto3.client("s3")
    resp = s3_client.get_object(Bucket=bucket, Key=key)
    data = json.load(resp["Body"])

    metadata = resp["Metadata"]
    s_asof=metadata["asof"]
    s_ingest=metadata["ingest"]
    ts_asof=pd.to_datetime(s_asof, format="%Y%m%d").floor("ms")
    ts_ingest=pd.to_datetime(s_ingest, format="%Y%m%d_%H%M%S_%f").floor("ms")

    raw_rows = list()
    raw_rows.append(get_ttl(data))
    for breakdown in data["break_down"]:
        raw_rows.append(get_breakdown(breakdown))

    rows = list()
    for _r in raw_rows:
        print(f"{_r=}")
        row={
            "asof": s_asof,
            "asof_ts": ts_asof,
            "ingest": s_ingest,
            "ingest_ts": ts_ingest,
            "category": _r["category"],
            "amount_raw": _r["amount_raw"],
            "amount": _r["amount"],
        }
        print(f"{row=}")
        rows.append(row)
    df = pd.DataFrame(rows).astype({
        "asof_ts": "datetime64[ms]",
        "ingest_ts": "datetime64[ms]",
        "amount": pd.ArrowDtype(pa.decimal128(10, 2))
    })
    pd.set_option('display.max_columns', 1000)
    print(f"{df=}")

    # delete dst partition
    qid = wr.athena.start_query_execution(
        sql=f"DELETE FROM {DST_DB}.{DST_TABLE} WHERE asof='{s_asof}' and ingest='{s_ingest}'",
        workgroup=WORKGROUP,
    )
    wr.athena.wait_query(query_execution_id=qid)

    # write dst
    result = wr.athena.to_iceberg(
        df=df,
        database=DST_DB,
        table=DST_TABLE,
        workgroup=WORKGROUP,
        temp_path=ICEBERG_STAGE,
    )
    respbody = {
        "bucket":bucket,
        "key":key,
        "asof":s_asof,
        "ingest":s_ingest,
    }
    return {
        'statusCode': 200,
        'body': json.dumps(respbody)
    }

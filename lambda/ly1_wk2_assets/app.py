import json
import boto3
from urllib.parse import unquote, unquote_plus
import awswrangler as wr
import pandas as pd
import pyarrow as pa
from uuid import uuid4
import io
import os
import datetime
from dateutil.relativedelta import relativedelta

def lambda_handler(event, context):
    SRC_DB     = os.getenv("SRC_DB")       or "scrpu_ly1"
    SRC_TABLE  = os.getenv("SRC_TABLE")    or "wk1_assets"
    DST_DB     = os.getenv("DST_DB")       or "scrpu_ly1"
    DST_TABLE  = os.getenv("DST_TABLE")    or "wk2_assets"
    WORKGROUP   = os.getenv("WORKGROUP")   or "wg_scrpu_dev"
    ICEBERG_STAGE = f"s3://scrpu-dev-dwh/tmp_iceberg_stage/{uuid4()}/"

    s_asof=event["asof"]
    s_ingest=event["ingest"]
    print(f'${s_asof=} ${s_ingest=}')

    # read src
    df = wr.athena.read_sql_query(
        sql=f"SELECT * FROM {SRC_DB}.{SRC_TABLE} WHERE asof='{s_asof}' AND ingest='{s_ingest}'",
        database=SRC_DB,
        workgroup=WORKGROUP,
        ctas_approach=False,
    )
    df.info()

    # data formatting
    df['category']=(
        df['category_raw']
        .replace('合計（円）','合計')
        .replace('預金・現金・暗号資産（円）','現預金')
        .replace('株式(現物)（円）','株式現物')
        .replace('投資信託（円）','投資信託')
        .replace('不動産（円）','不動産')
        .replace('年金（円）','年金')
        .replace('ポイント（円）','ポイント')
        .replace('その他の資産（円）','その他資産')
    )
    df["dt"] = df["dt_raw"].str.replace("/","")
    df["dt_ts"] = pd.to_datetime(df["dt_raw"], format="%Y/%m/%d")
    df["amount"] = df['amount_raw'].astype(pd.ArrowDtype(pa.decimal128(10, 2)))

    # filter
    dt_compare = datetime.datetime.strptime(f'{s_asof[0:6]}01','%Y%m%d') + relativedelta(months=-1)
    df = df[df["dt_ts"] >= dt_compare]
    df = df[['asof', 'asof_ts', 'ingest', 'ingest_ts', 'dt', 'dt_ts', 'category', 'amount']]

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

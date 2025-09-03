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
    SRC_TABLE  = os.getenv("SRC_TABLE")    or "wk2_assets"
    DST_DB     = os.getenv("DST_DB")       or "scrpu_ly1"
    DST_TABLE  = os.getenv("DST_TABLE")    or "fix_assets"
    WORKGROUP   = os.getenv("WORKGROUP")   or "wg_scrpu_dev"
    ICEBERG_STAGE = f"s3://scrpu-dev-dwh/tmp_iceberg_stage/{uuid4()}/"

    # read src
    df = wr.athena.read_sql_query(
        sql=f"""
        SELECT * FROM (
            SELECT * 
            , RANK() OVER(PARTITION BY dt ORDER BY asof_ts desc, ingest_ts desc) AS rank
            FROM {SRC_DB}.{SRC_TABLE}
        )
        WHERE rank = 1
        """,
        database=SRC_DB,
        workgroup=WORKGROUP,
        ctas_approach=False,
    )
    df.info()

    # select column
    df = df[['asof', 'asof_ts', 'dt', 'dt_ts', 'category', 'amount']]
    df.info()

    # delete dst
    qid = wr.athena.start_query_execution(
        sql=f"DELETE FROM {DST_DB}.{DST_TABLE} WHERE true",
        workgroup=WORKGROUP,
    )
    wr.athena.wait_query(query_execution_id=qid)

    # write dst
    wr.athena.to_iceberg(
        df=df,
        database=DST_DB,
        table=DST_TABLE,
        workgroup=WORKGROUP,
        temp_path=ICEBERG_STAGE,
    )

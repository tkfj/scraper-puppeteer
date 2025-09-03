import json
import awswrangler as wr
import pandas as pd
import os
from uuid import uuid4

def lambda_handler(event, context):
    SRC_DB      = os.getenv("SRC_DB")      or "scrpu_ly1"
    SRC_TABLE   = os.getenv("SRC_TABLE")   or "wk1_liabilities_ttl"
    DEST_DB     = os.getenv("DEST_DB")     or "scrpu_ly1"
    DEST_TABLE  = os.getenv("DEST_TABLE")  or "fix_liabilities_ttl"
    WORKGROUP   = os.getenv("WORKGROUP")   or "wg_scrpu_dev"   # Athena SQL v3

    ICEBERG_STAGE = f"s3://scrpu-dev-dwh/tmp_iceberg_stage/{uuid4()}/"

    # read src
    df = wr.athena.read_sql_query(
        sql=f"SELECT * FROM {SRC_DB}.{SRC_TABLE}",
        database=SRC_DB,
        workgroup=WORKGROUP,
        ctas_approach=False,
    )

    # filter
    mask = df["ingest_ts"].eq(df.groupby("asof_ts")["ingest_ts"].transform("max"))
    df_f = df.loc[mask].reset_index(drop=True)
    cols = ["dt", "dt_ts", "ttl"]
    df_out = df_f.rename(columns={"asof": "dt", "asof_ts": "dt_ts"}).reindex(columns=cols)

    # delete old dst
    qid = wr.athena.start_query_execution(
        sql=f"DELETE FROM {DEST_DB}.{DEST_TABLE} WHERE true",
        workgroup=WORKGROUP,
    )
    wr.athena.wait_query(query_execution_id=qid)

    # write dst
    if not df_out.empty:
        wr.athena.to_iceberg(
            df=df_out,
            database=DEST_DB,
            table=DEST_TABLE,
            workgroup=WORKGROUP,
            temp_path=ICEBERG_STAGE,
        )
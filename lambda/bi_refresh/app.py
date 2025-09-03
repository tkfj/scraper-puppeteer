import json
import uuid, boto3, time


def get_account_id_via_sts() -> str:
    sts = boto3.client("sts")
    return sts.get_caller_identity()["Account"]

def lambda_handler(event, context):
    qs = boto3.client("quicksight")

    AWS_ACCOUNT_ID = get_account_id_via_sts()
    DATASET_ID = event['dataset']
    INGESTION_ID = str(uuid.uuid4())

    print("starting...");
    qs.create_ingestion(
        AwsAccountId=AWS_ACCOUNT_ID,
        DataSetId=DATASET_ID,
        IngestionId=INGESTION_ID,
        IngestionType="FULL_REFRESH"
    )
    print("start.");

    while True:
        s = qs.describe_ingestion(
            AwsAccountId=AWS_ACCOUNT_ID,
            DataSetId=DATASET_ID,
            IngestionId=INGESTION_ID
        )["Ingestion"]["IngestionStatus"]
        print("status:", s);
        if s in ("COMPLETED", "FAILED", "CANCELLED"):
            break
        time.sleep(5)
    if s != 'COMPLETED':
        raise Exception(f"Ingestion failed: {s}")

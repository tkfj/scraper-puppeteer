import json
import boto3
import datetime
import os

TZ = datetime.timezone(datetime.timedelta(hours=9))

def main(event:any):
    s3_bucket = os.environ['SCRAPER_STORE_BUCKET']
    s3_key_base = os.environ.get('SCRAPER_STORE_KEY_BASE','')
    dt_ingest = datetime.datetime.now(TZ)
    str_dt_asof = event['date']
    dt_asof = datetime.datetime.strptime(str_dt_asof, '%Y%m%d').replace(tzinfo=TZ)
    str_dt_ingest=dt_ingest.strftime('%Y%m%d_%H%M%S_%f')
    print(f'{dt_ingest=}')
    print(f'{str_dt_ingest=}')
    print(f'{str_dt_asof=}')
    print(f'{dt_asof=}')
    event['ingest'] = str_dt_ingest
    b_event = json.dumps(event).encode('utf-8')
    print(f'{b_event=}')
    s3cli = boto3.client('s3')
    s3cli.put_object(**{
        'Bucket' : s3_bucket,
        'Key' : f'{s3_key_base}0_bronze/liabilities/ingest={str_dt_ingest}/liabilities_{str_dt_asof}.json',
        'ContentType': 'application/json',
        'Body': b_event,
    })

def lambda_handler(event, context):
    main(event)
    return {
        'statusCode': 200,
        'body': json.dumps('Hello from Lambda!')
    }

if __name__ == "__main__":
    intext="""
{
  "date": "20250826",
  "total_amount": "負債総額： 13,102,029円",
  "break_down": [
    {
      "k": "クレジットカード利用残高",
      "v": "756,351円"
    },
    {
      "k": "住宅ローン",
      "v": "12,345,678円"
    }
  ],
  "detail": [
    {
      "t": "クレジットカード利用残高",
      "n": "ご利用残高",
      "v": "654,321円",
      "w": "CCCCCCカード"
    },
    {
      "t": "クレジットカード利用残高",
      "n": "ご利用残高",
      "v": "102,030円",
      "w": "DDDDDDカード"
    },
    {
      "t": "住宅ローン",
      "n": "住宅ローン",
      "v": "12,345,678円",
      "w": "BBBBBB銀行"
    }
  ]
}
"""
    indata = json.loads(intext)
    lambda_handler(indata,{})

# scraper-puppeteer
puppeteer(headless chrome)を使ってweb上でなんやかんやします

- スクレイピング機能
  - マネーフォワードの金融機関一括更新ボタンを押下
  - マネーフォワードの負債金額を取得
  - マネーフォワードの資産CSVをダウンロード
- おまけ機能(むしろ本命)
  - Athena上に 資産、負債、純資産を履歴として蓄積


## システム構成
※Terraformで構成していますがこちらのプロジェクトは非公開です

- EC2(Windows)
  - スクレイピング用。nodejs
  - SQSのメッセージ数によるAutoScalingで起動制御
- Glue, Athena, Lambda(Python-pandas)
  - データ加工
- S3
  - 生データ、加工データの格納
- EventBridge, StepFunctions, SQS
  - スクレイピング起動指示、データ加工制御
- QuickSight
  - 可視化

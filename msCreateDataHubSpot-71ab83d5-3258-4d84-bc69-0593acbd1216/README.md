# Hubspot

## Repositório: [ESBSamiHealth/services-hubspot](https://git-codecommit.us-east-1.amazonaws.com/v1/repos/ESBSamiHealth)

## Fila pra envio de membros: [prd_export_hubspot.fifo](https://us-east-1.console.aws.amazon.com/sqs/v2/home?region=us-east-1#/queues/https%3A%2F%2Fsqs.us-east-1.amazonaws.com%2F707583345549%2Fprd_export_hubspot.fifo)

## CloudWatch do envio de membros: [msCreateDataHubSpot](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252FmsCreateDataHubSpot)

## Mapeamento dos dados de envio: [Hubspot_Export_prd](https://us-east-1.console.aws.amazon.com/dynamodbv2/home?region=us-east-1#item-explorer?initialTagKey=&table=Hubspot_Export_prd)

## Tabela controle de envio: [CoverageControl_Export_prd](https://us-east-1.console.aws.amazon.com/dynamodbv2/home?region=us-east-1#item-explorer?initialTagKey=&table=CoverageControl_Export_prd)

## Erros de envio: Canal do Slack (data-log)
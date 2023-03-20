# Microserviço que recebe eventos Cingulo


- O lambda sera invocado atraves the um POST

URL dev: https://wkycb94iw8.execute-api.us-east-1.amazonaws.com/dev/interop-cingulo/event
URL hml: https://wkycb94iw8.execute-api.us-east-1.amazonaws.com/hml/interop-cingulo/event
URL prd: https://wkycb94iw8.execute-api.us-east-1.amazonaws.com/prd/interop-cingulo/event

- O lambda validará o Header:
    Authorization: Bearer <token>
que deverá bater com a configuração armazenada na parameters Store em:
    /Interop/cingulo_config


- O Body da request então será enviado para o S3 ao Bucket:
    /sami-data-interoperabilidade/cingulo-{env dev|hml|prd}/{data do envento}/{cpf do beneficiario}


// TODO: mapeamento das informações para o DW

- O lambda retornará:
    Http 200 caso o processo ocorra sem error
    Http 401 caso o token esteja ausente ou seja inválido
    Http 500 caso um erro ocorra durante a execução



// layers
const utils = require("utils.js");
const got = require("got");
const pgknex = require("pgknex");
const excel = require("excel4node");
const { isNil, isEmpty } = require("lodash");

// SSM
const ssmLib = require("aws-sdk/clients/ssm");
const ssm = new ssmLib();

//dynamoDB
const awsDynamodb = require("aws-sdk/clients/dynamodb");
const dynamo = new awsDynamodb();
const converter = awsDynamodb.Converter;

//lambda
const lambdaLib = require("aws-sdk/clients/lambda");
const lambda = new lambdaLib();

// S3
const s3Lib = require("aws-sdk/clients/s3");
const s3 = new s3Lib();

const FormData = require("form-data");

async function sendMissingDocumentError(lifeId, env) {
  if (env === "prd") {
    try {
      utils.invokeLambda(lambda, "msSlackChatBotInterop", {
        lambda: "msExportAuthorizationToCingulo",
        resourceType: "lives",
        id: lifeId,
        modified: new Date().toDateString(),
        err: new Error("missing document_identification_primary"),
      });
    } catch (err) {
      console.log(err);
    }

    return;
  }

  console.log(
    `>>> Ignoring life_id = ${lifeId} / There's no document_identification_primary <<<`
  );
}

function buildQueryLives(schema) {
  return `select distinct l.id, l.name, l.document_identification_primary, lc.email, coalesce(lc.phone_mobile, lc.phone_home, null) as phone,
            case when b.company_id=196 then 'Funcionário Sami' else 'Membro Pagante' end as classificacao,
            c.document_identification_primary as cnpj, c.name as razao, 
            b.status_source_value as status, b.start_at as dataInit, b.updated_at as dataUpdate 
          from ${schema}.lives l
            inner join ${schema}.beneficiaries b on l.id=b.life_id
            left  join ${schema}.life_contacts lc on l.id=lc.life_id
            left  join ${schema}.companies c on b.company_id = c.id
          where l.birth_at < ('now'::timestamp - '14 year'::interval)
            and b.start_at < now()
            and b.status_source_value = 'active'
            and l.document_identification_primary notnull
            order by l.name, l.document_identification_primary`;
}

function buildQueryIncoming(schema) {
  return `select distinct l.id, l.name, l.document_identification_primary, lc.email, coalesce(lc.phone_mobile, lc.phone_home, null) as phone,
            case when b.company_id=196 then 'Funcionário Sami' else 'Membro Pagante' end as classificacao,
            c.document_identification_primary as cnpj, c.name as razao,
            b.status_source_value as status, b.start_at as dataInit, b.updated_at as dataUpdate 
          from ${schema}.lives l
            inner join ${schema}.beneficiaries b on l.id=b.life_id
            left  join ${schema}.life_contacts lc on l.id=lc.life_id
            left  join ${schema}.companies c on b.company_id = c.id
          where b.start_at >= ('now'::timestamp - '8 day'::interval)
            and b.start_at < now()
            and b.status_source_value = 'active'
            and l.document_identification_primary notnull
            order by l.name, l.document_identification_primary`;
}

function buildQueryOutcoming(schema) {
  return `select distinct l.id, l.name, l.document_identification_primary, lc.email, coalesce(lc.phone_mobile, lc.phone_home, null) as phone,
            case when b.company_id=196 then 'Funcionário Sami' else 'Membro Pagante' end as classificacao,
            c.document_identification_primary as cnpj, c.name as razao,
            b.status_source_value as status, b.start_at as dataInit, b.updated_at as dataUpdate 
          from ${schema}.lives l
            inner join ${schema}.beneficiaries b on l.id=b.life_id
            left  join ${schema}.life_contacts lc on l.id=lc.life_id
            left  join ${schema}.companies c on b.company_id = c.id
          where b.updated_at >= ('now'::timestamp - '8 day'::interval)
            and b.start_at < now()
            and b.status_source_value <> 'active'
            and l.document_identification_primary notnull
            order by l.name, l.document_identification_primary`;
}

async function postCinguloFile(url, samiToken, file) {
  console.log(">>> Sending Cíngulo Spreadsheet <<<");

  const formData = new FormData();
  formData.append("file", file, { filename: "file.xlsx" });

  const result = await got.post(url, {
    headers: {
      ContentType: "multipart/form-data",
      Authorization: `Bearer ${samiToken}`,
    },
    body: formData,
  });

  console.log(result);

  return result;
}

async function createSpreadsheet(lives, env) {
  const missingDocument = []; //lives sem documento primario

  //cria a planilha
  var wb = new excel.Workbook();
  var ws = wb.addWorksheet("Lives");

  ws.cell(1, 1).string("CPF");
  ws.cell(1, 2).string("Primeiro Nome");
  ws.cell(1, 3).string("Email");
  ws.cell(1, 4).string("Telefone");
  ws.cell(1, 5).string("Razao social");
  ws.cell(1, 6).string("CNPJ");
  ws.cell(1, 7).string("Classificacao");

  var i = 1;
  lives.forEach((life) => {
    if (
      !life.document_identification_primary ||
      life.document_identification_primary === ""
    ) {
      missingDocument.push(life);
      return;
    }

    i = i + 1;
    ws.cell(i, 1).string(life.document_identification_primary);
    ws.cell(i, 2).string(life.name.trim().split(" ")[0]);
    ws.cell(i, 3).string(life.email || "");
    ws.cell(i, 4).string(life.phone || "");
    ws.cell(i, 5).string(life.classificacao);
    ws.cell(i, 6).string(life.cnpj || "");
    ws.cell(i, 7).string(life.razao || "");
  });

  const file = await wb.writeToBuffer();

  missingDocument.forEach((life) => sendMissingDocumentError(life.id, env));

  return file;
}

// Busca registros na tabela de controle Dynamo
async function updateCinguloControlTable(lives, env) {
  let insertActive = []; //lista com registros lives
  let insertInactive = []; //lista com registros da tabela de controle

  const data = await dynamo
    .scan({ TableName: `PatientsCingulo_${env}` })
    .promise();

  if (data && data.Items) {
    for (const o of data.Items) {
      const controlRow = converter.unmarshall(o);
      let found = false;

      //verifica se registro ainda existe caso não exista marca para inativação
      for (const lifeRow of lives) {
        if (
          lifeRow.document_identification_primary === controlRow.identification
        ) {
          found = true;
          break;
        }
      }

      if (!found) {
        insertInactive.push(controlRow);
      }
    }
  }

  for (const l of lives) {
    if (!l.document_identification_primary) {
      continue;
    }

    const currentRecord = await getControl(
      env,
      l.document_identification_primary
    );

    if (!currentRecord || currentRecord.status == "inactive") {
      insertActive.push(l);
    }
  }

  for (const o of insertActive) { //registros datawarehouse
    console.log(
      `>>> Inserindo registro ativo ${o.document_identification_primary} <<<`
    );
    await insertControl(env, o.document_identification_primary, "active");
  }

  for (const o of insertInactive) { //registros dynamo PatientsCingulo_<env>
    console.log(
      `>>> Inserindo registro inativo ${o.identification} <<<`
    );
    await insertControl(env, o.identification, "inactive");
  }
}

// Busca registro na tabela de controle Dynamo
async function getControl(env, identification) {
  const data = await dynamo
    .query({
      TableName: `PatientsCingulo_${env}`,
      ScanIndexForward: false, //registro mais recente primeiro
      KeyConditionExpression: "identification = :identification",
      ExpressionAttributeValues: {
        ":identification": {
          S: identification,
        },
      },
    })
    .promise();

  if (!data || !data.Items) {
    return null;
  }

  const record = converter.unmarshall(data.Items[0]);

  if (isNil(record) || isEmpty(record)) {
    return null;
  }

  return record;
}

// Insere registro na tabela de controle
async function insertControl(env, identification, status) {
  return await dynamo
    .putItem({
      TableName: `PatientsCingulo_${env}`,
      Item: converter.marshall({
        identification: identification,
        date: new Date().toISOString().slice(0, 10),
        status: status,
      }),
    })
    .promise();
}

async function saveBucket(lives) {
  try {
    await s3
      .putObject({
        Bucket: "sami-data-interoperabilidade",
        Key: `base_cingulo/envios/${new Date()
          .toISOString()
          .slice(0, 10)}.json`,
        ContentType: "application/json",
        Body: JSON.stringify(lives),
      })
      .promise();

    console.log(
      ">>> Armazenado no: s3://sami-data-interoperabilidade/base_cingulo/envios <<<"
    );
  } catch (err) {
    throw err;
  }
}

async function saveBucketIncoming(lives) {
  try {
    await s3
      .putObject({
        Bucket: "sami-data-interoperabilidade",
        Key: `base_cingulo/envios/${new Date()
          .toISOString()
          .slice(0, 10)}_Incoming.json`,
        ContentType: "application/json",
        Body: JSON.stringify(lives),
      })
      .promise();

    console.log(
      ">>> Armazenado no: s3://sami-data-interoperabilidade/base_cingulo/envios - Incoming <<<"
    );
  } catch (err) {
    throw err;
  }
}

async function saveBucketOutcoming(lives) {
  try {
    await s3
      .putObject({
        Bucket: "sami-data-interoperabilidade",
        Key: `base_cingulo/envios/${new Date()
          .toISOString()
          .slice(0, 10)}_Outcoming.json`,
        ContentType: "application/json",
        Body: JSON.stringify(lives),
      })
      .promise();

    console.log(
      ">>> Armazenado no: s3://sami-data-interoperabilidade/base_cingulo/envios - Outcoming <<<"
    );
  } catch (err) {
    throw err;
  }
}

exports.handler = async (event, context, callback) => {
  try {
    const env = utils.assertRequiredValue("env", event.env, "string");
    const schema = utils.assertRequiredValue(
      "db_schema",
      event.db_schema,
      "string"
    );

    console.log(`>>> env: ${env} <<<`);
    console.log(`>>> schema: ${schema} <<<`);

    const config = (await utils.getSsmParam(ssm, "/Interop/cingulo_config"))[
      env
    ];

    // conecta no postgres
    await pgknex.connect("connection_params");

    //seleciona lives
    const lives = await pgknex.select(buildQueryLives(schema));

    const livesIncoming = await pgknex.select(buildQueryIncoming(schema));
    
    const livesOutcoming = await pgknex.select(buildQueryOutcoming(schema));

    pgknex.disconnect();

    console.log(`>>> Total de membros enviados: ${lives.length} - Membros ativados: ${livesIncoming.length} - Membros inativados: ${livesOutcoming.length} <<<`);

    await saveBucket(lives);

    await saveBucketIncoming(livesIncoming);

    await saveBucketOutcoming(livesOutcoming);

    //constroi a planilha para envio
    const file = await createSpreadsheet(lives, env);

    //envia arquivo
    await postCinguloFile(config.elegiveisUrl, config.samiToken, file);

    //atualiza controle
    // await updateCinguloControlTable(lives, env);

    callback(null, "Finished");

    return ">>> Importação finalizada <<<";
  } catch (err) {
    utils.handleError(err);
  } finally {
    pgknex.disconnect();
  }
};

// layers
const utils = require("utils.js");
const got = require("got");
const pgknex = require("pgknex");

// SSM
const ssmLib = require("aws-sdk/clients/ssm");
const ssm = new ssmLib();

// S3
const s3Lib = require("aws-sdk/clients/s3");
const s3 = new s3Lib();

function buildQueryLives(schema) {
  return `select distinct '36567721000125' as cnpj, l.document_identification_primary as cpf, l.name as nome, lc.email as email,
            b.health_card_number as matricula, ll.state as estado, ll.city as cidade, to_char(b.start_at, 'dd/MM/yyyy') as dt_admissao, 
            to_char(l.birth_at, 'dd/MM/yyyy') as dt_nascimento, 0 as limite, c.document_identification_primary as unidade, b.status_source_value as status
          from ${schema}.lives l
            inner join ${schema}.beneficiaries b on l.id = b.life_id
            inner join ${schema}.life_locations ll on l.id = ll.life_id 
            left  join ${schema}.life_contacts lc on l.id = lc.life_id
            left  join ${schema}.companies c on b.company_id = c.id
          where l.birth_at < ('now'::timestamp - '18 year'::interval)
            and b.start_at < now()
            and b.start_at >= '2023-01-26'::date
            and b.status_source_value = 'active'
            and l.document_identification_primary is not null
            and c.created_at >= '2023-01-26'::date
          order by l.name, l.document_identification_primary`;
}

async function postMediprecoPaginated(url, token, lives, limit) {
  var data = {
    api_key: '',
    atualiza_limite: 0,
    pessoas: []
  };

  data.api_key = token;

  var pages = Math.trunc(lives.length / limit);
  var rest = (lives.length % limit);
  
  if (rest > 0) {
    pages++;
  }
  
  var init;
  var end;
  
  for(let page = 0; page < pages; page++) {
    init = (page * limit);
    end = ((page + 1) * limit);
    
    data.pessoas = lives.slice(init, end);

    await postMedipreco(url, data);
  }

  return;
}

async function postMedipreco(url, data) {
  const result = await got.post(url, {
    headers: {
      ContentType: "application/json",
    },
    body: JSON.stringify(data),
  });
  
  console.log(result);
}

async function saveBucket(lives) {
  try {
    await s3
      .putObject({
        Bucket: "sami-data-interoperabilidade",
        Key: `base_medipreco/envios/${new Date()
          .toISOString()
          .slice(0, 10)}.json`,
        ContentType: "application/json",
        Body: JSON.stringify(lives),
      })
      .promise();

    console.log(
      ">>> Armazenado no: s3://sami-data-interoperabilidade/base_medipreco/envios <<<"
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

    const config = (await utils.getSsmParam(ssm, "/Interop/medipreco_config"))[
      env
    ];

    await pgknex.connect("connection_params");

    const lives = await pgknex.select(buildQueryLives(schema));

    pgknex.disconnect();

    console.log(`>>> Total de membros enviados: ${lives.length} <<<`);

    await saveBucket(lives);

    await postMediprecoPaginated(config.sendUrl, config.apiKey, lives, config.sendLimit);

    callback(null, "Finished");
  } catch (err) {
    utils.handleError(err);
  } finally {
    pgknex.disconnect();
  }
};

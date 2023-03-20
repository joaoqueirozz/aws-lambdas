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

const FormData = require("form-data");

async function getPasswordByDate() {
  var dateEnv = new Date();
  var password;

  switch (dateEnv.getDay()) {
    case 0:
      password = "Tezcatlipoca"; 
      break;
    case 1:
      password = "Athena";
      break;
    case 2:
      password = "Thoth"; 
      break;
    case 3:
      password = "Omoikane"; 
      break;
    case 4:
      password = "Sagesse"; 
      break;
    case 5:
      password = "Agni"; 
      break;
    case 6:
      password = "Ningishzida"; 
      break;
  }

  return password;
}

function buildQueryLives(schema) {
  return `select distinct l.id as life_id, l.document_identification_primary as cpf, l.name as nome, lc.email as email,
            b.health_card_number as card_number, ll.state as state, ll.city as city, to_char(b.start_at, 'dd/MM/yyyy') as start_at, 
            to_char(l.birth_at, 'dd/MM/yyyy') as birth_at, hp.name as health_plan, c.document_identification_primary as cnpj, b.status_source_value as status
          from ${schema}.lives l
            inner join ${schema}.beneficiaries b on l.id = b.life_id
            inner join ${schema}.life_locations ll on l.id = ll.life_id
            inner join ${schema}.health_plans hp on hp.id = b.health_plan_id 
            left  join ${schema}.life_contacts lc on l.id = lc.life_id
            left  join ${schema}.companies c on b.company_id = c.id
          where b.start_at < now()
            and hp.id in (1, 5, 6, 8, 9)
          order by l.id asc`;
}

async function postPaginated(url, token, lives, limit) {
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
    
    console.log(page + " " + pages + " " + lives.slice(init, end).length);

    postFile(url, token, lives.slice(init, end));
  }
}

async function postFile(url, token, lives) {
  const formData = new FormData();
  formData.append("json_file", JSON.stringify(lives), { filename: "json_file.json" });
  
  const result = await got.post(url + token, {
    headers: {
      ContentType: "multipart/form-data",
    },
    body: formData,
  });

  console.log(result);
}

async function saveBucket(lives) {
  try {
    await s3
      .putObject({
        Bucket: "sami-data-interoperabilidade",
        Key: `base_humanitar/envios/${new Date()
          .toISOString()
          .slice(0, 10)}.json`,
        ContentType: "application/json",
        Body: JSON.stringify(lives),
      })
      .promise();
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

    const config = (await utils.getSsmParam(ssm, "/Interop/humanitar_config"))[
      env
    ];

    // conecta no postgres
    await pgknex.connect("connection_params");

    //seleciona lives
    const lives = await pgknex.select(buildQueryLives(schema));

    pgknex.disconnect();

    //salca os dados enviados
    await saveBucket(lives);

    //gera senha de acordo com o dia
    const password = await getPasswordByDate();

    //envia arquivo
    await postPaginated(config.sendUrl, password, lives, config.sendLimit);

    callback(null, "Finished");

    return ">>> Processo finalizado <<<";
  } catch (err) {
    utils.handleError(err);
  } finally {
    pgknex.disconnect();
  }
};

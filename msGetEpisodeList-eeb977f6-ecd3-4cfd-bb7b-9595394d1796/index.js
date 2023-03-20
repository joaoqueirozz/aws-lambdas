var axios = require("axios").default;
const http = require("https");

// layers
const utils = require("utils.js");
const pgknex = require("pgknex");

function buildQueryEpisodes(schema, patient, date) {
  const query = [];
  query.push(
    `select e.id as encounter, e.start_at as date from ${schema}.episodes e `
  );
  query.push(`inner join ${schema}.lives l `);
  query.push(`on e.life_id = l.id `);
  query.push(`inner join ${schema}.beneficiaries b `);
  query.push(`on l.id = b.life_id `);
  query.push(
    `where b.health_card_number = '${patient}' and e.care_site_id = 1826 `
  );

  if (date) {
    query.push(`and e.start_at >= '${date}'`);
  }

  return query.join("");
}

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    console.log(event);
    const schema = utils.assertRequiredValue(
      "schema",
      event.db_schema,
      "string"
    );
    console.log(`>>> Schema: ${schema} <<<`);

    const patient = utils.assertRequiredValue(
      "patient",
      event.patient,
      "string"
    );
    console.log(`>>> Carteirinha: ${patient} <<<`);

    let date;

    if (event.date) {
      try {
        date = new Date(event.date).toISOString();
        console.log(`>>> Date: ${date} <<<`);
      } catch (err) {
        console.log(err);
        throw utils.buildCustomError(400, "Data inválida");
      }
    }

    await pgknex.connect("connection_params");

    //-----------------------------------------------------------------------------

    var options = {
      method: "POST",
      url: "https://app-br.onetrust.com/api/access/v1/oauth/token",
      headers: {
        "Content-Type": "multipart/form-data",
        "content-type":
          "multipart/form-data; boundary=---011000010111000001101001",
      },
      data: '-----011000010111000001101001\r\nContent-Disposition: form-data; name="grant_type"\r\n\r\nclient_credentials\r\n-----011000010111000001101001\r\nContent-Disposition: form-data; name="client_id"\r\n\r\n17688ec70aea4e179598dfae9a8b4d18\r\n-----011000010111000001101001\r\nContent-Disposition: form-data; name="client_secret"\r\n\r\ne1i3cNOX1BFW2NvAic14VcWULVH3f9Po\r\n-----011000010111000001101001--\r\n\r\n',
    };

    // retorna o token de acesso ao consentimento
    const token = await axios
      .request(options)
      .then(function (response) {
        return response.data.access_token;
      })
      .catch(function (error) {
        console.error(error);
      });

    var opt = {
      method: "GET",
      url: "https://app-br.onetrust.com/api/consentmanager/v1/datasubjects/profiles?purposeGuid=93524917-5c4b-4507-a50b-16262cb6df83",
      headers: {
        "Content-Type": "application/json",
        identifier: patient,
        Authorization: "Bearer " + token,
      },
    };

    // retorna o status do consentimento do membro
    const consent = await axios
      .request(opt)
      .then(function (response) {
        if (response.data.content[0]) {
          return response.data.content[0].Purposes[0].Status;
        } else {
          return "EMPTY";
        }
      })
      .catch(function (error) {
        console.error(error);
      });

    console.log(`>>> Consentimento: ${consent} <<<`);

    //-----------------------------------------------------------------------------

    let episodes;

    if (consent === "ACTIVE") {
      // obtém os atendimentos do DW
      episodes = await pgknex.select(buildQueryEpisodes(schema, patient, date));
    } else {
      episodes = [];
    }

    console.log(JSON.stringify(episodes));

    return episodes;
  } catch (err) {
    utils.handleError(err);
    console.log(err);
  } finally {
    pgknex.disconnect();
  }
};

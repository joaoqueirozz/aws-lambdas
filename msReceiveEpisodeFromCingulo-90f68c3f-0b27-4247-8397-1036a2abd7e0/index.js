// node
const crypto = require("crypto");
const utils = require("utils.js");

// SSM
const ssmLib = require("aws-sdk/clients/ssm");
const ssm = new ssmLib();
// Layers
const pgknex = require("pgknex");
const got = require("got");

// Modules
const rds = require("./modules/rds");
const s3 = require("./modules/s3");

let config;
let resource;
let procedure;
let observation;

function queryLife(schema, cpf) {
  const query = [];

  query.push(
    `select id from ${schema}.lives l where document_identification_primary = '${cpf}' `
  );

  return query.join("");
}

// Confere se já existe o hash
function buildQueryHash(hash) {
  const query = [];

  query.push(`select vezes_recebido from recop.tac t where hash = '${hash}' `);

  return query.join("");
}

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  // RequestId do evento no CloudWatch (Recop)
  const aws_request_id = context.awsRequestId;

  try {
    const db_schema = utils.assertRequiredValue(
      "db_schema",
      event.db_schema,
      "string"
    );

    const env = utils.assertRequiredValue("env", event.env, "string");

    const token = utils.assertRequiredValue("token", event.token, "string");

    config = (await utils.getSsmParam(ssm, "/Interop/cingulo_config"))[env];

    if (`Bearer ${config.cinguloToken}` !== token) {
      //valida se o evento veio da origem correta
      const err = new Error("access denied");
      err.statusCode = 401;
      throw err;
    }

    if (!event.payload) {
      throw new Error("no payload");
    }

    console.log(JSON.stringify(event.payload));

    // Rotina 0 (Recop) - Hash MD5 do bundle
    const pacote = JSON.stringify(event.payload);
    const hash = crypto.createHash("md5").update(pacote).digest("hex");
    console.log(`>>> hash: ${hash} <<<`);

    // await pgknex.connect("connection_params");
    await pgknex.connect("/Interop/igor_params"); // provisório

    // Confere se já existe o mesmo hash na TAC
    const hash_rep = await pgknex.select(buildQueryHash(hash));

    if (hash_rep.length === 0) {
      hash_rep[0] = { vezes_recebido: 0 };
    }

    pgknex.disconnect();

    const hash_count = hash_rep[0].vezes_recebido;

    const year = event.payload.date_time.slice(0, 4);
    const month = event.payload.date_time.slice(5, 7);
    const day = event.payload.date_time.slice(8, 10);

    const path = `recop/ddp/Cingulo/${year}/${month}/${day}/${aws_request_id}.json`;

    // Monta as informações de envio para a TAC
    const tac = {
      hash: hash,
      id_pacote: aws_request_id,
      arquivo: `s3://sami-data-interoperabilidade/${path}`,
      status: 1,
      editor: "Lambda msReceiveEpisodeFromCingulo",
      vezes_recebido: hash_count + 1,
      id_fonte: "Cingulo",
    };

    // conecta no DW
    await rds.connect();

    // Contabilizar na TAC e armazenar na DDP se não existir
    if (hash_count === 0) {
      // Armazena na DDP (nunca foi recebido)
      await s3.recopSaveRaw(event.payload, path);

      // Contabiliza na TAC
      await rds.queryCreateTac(tac);
    } else {
      // Atualiza na TAC
      await rds.queryUpdateTac(hash, tac);
    }
    // desconecta do DW
    rds.disconnect();

    // Mapeamento para o DW
    await pgknex.connect("connection_params");

    // Obtém o life_id do membro
    const member = await pgknex.select(queryLife(db_schema, event.payload.id1));
    const life = JSON.parse(JSON.stringify(member[0])).id;

    console.log(`>>> Life ID: ${life} <<<`);

    pgknex.disconnect();

    // conecta no DW
    await rds.connect();

    const episode = {
      life_id: life,
      care_site_id: 1858,
      start_at: event.payload.date_time,
      stop_at: event.payload.date_time,
    };

    if (event.payload.event === "benefit_activation") {
      episode.episode_template = "Ativação do Benefício";
      resource = "Episode";
    } else if (event.payload.event === "benefit_removal") {
      episode.episode_template = "Remoção do Benefício";
      resource = "Episode";
    } else if (event.payload.event === "assessment_result") {
      episode.episode_template = "Resultado de Autoavaliação";
      resource = "Observation";
    } else if (event.payload.event === "diary") {
      episode.episode_template = "Uso do Diário Emocional";
      resource = "Episode";
    } else if (event.payload.event === "session") {
      episode.episode_template = "Séries";
      resource = "Procedure";
    } else if (event.payload.event === "cm") {
      episode.episode_template = "Cirurgia da Mente";
      resource = "Procedure";
    } else if (event.payload.event === "tool") {
      episode.episode_template = "Uso de Técnica";
      resource = "Procedure";
    } else if (event.payload.event === "human_interaction") {
      episode.episode_template = "Interação com Terapeura por Chat";
      resource = "Observation";
    } else if (event.payload.event === "assessment_custom_question") {
      episode.episode_template = "Resposta à Pergunta Específica";
      resource = "Observation";
    } else if (event.payload.event === "critical_text") {
      episode.episode_template = "Alarme de Texto Crítico";
      resource = "Observation";
    } else {
      console.log(`>>> Evento "${event.payload.event}" não mapeado ainda <<<`);
    }

    console.log(
      `>>> Evento: ${episode.episode_template} (${event.payload.event}) <<<`
    );

    // Cria o episode no DW
    const episodeID = await rds.createEpisode(db_schema, episode);

    console.log(`>>> Episode ID: ${episodeID[0]} <<<`);

    if (event.payload.event === "session") {
      procedure = {
        life_id: life,
        episode_id: episodeID[0],
        occurrence_at: event.payload.date_time,
        procedure_type_source_value: event.payload.parameters.track,
        procedure_source_value: event.payload.parameters.session,
        care_site_id: 1858,
      };
    } else if (event.payload.event === "cm") {
      procedure = {
        life_id: life,
        episode_id: episodeID[0],
        occurrence_at: event.payload.date_time,
        procedure_type_source_value: event.payload.parameters.program,
        procedure_source_value: event.payload.parameters.session,
        care_site_id: 1858,
      };
    } else if (event.payload.event === "tool") {
      procedure = {
        life_id: life,
        episode_id: episodeID[0],
        occurrence_at: event.payload.date_time,
        procedure_source_value: event.payload.parameters.name,
        care_site_id: 1858,
      };
    } else if (event.payload.event === "human_interaction") {
      observation = {
        life_id: life,
        episode_id: episodeID[0],
        occurrence_at: event.payload.date_time,
        observation: event.payload.parameters.comment,
        care_site_id: 1858,
      };
    } else if (
      event.payload.event === "assessment_custom_question" ||
      event.payload.event === "critical_text"
    ) {
      observation = {
        life_id: life,
        episode_id: episodeID[0],
        occurrence_at: event.payload.date_time,
        observation_type_source_value: event.payload.parameters.question,
        observation_source_value: event.payload.parameters.answer,
        care_site_id: 1858,
      };
    } else if (event.payload.event === "assessment_result") {
      observation = {
        life_id: life,
        episode_id: episodeID[0],
        occurrence_at: event.payload.date_time,
        care_site_id: 1858,
      };
    }

    if (resource === "Procedure") {
      // Cria o procedure no DW
      const procedureID = await rds.createProcedure(db_schema, procedure);

      console.log(`>>> Procedure ID: ${procedureID[0]} <<<`);
    } else if (
      resource === "Observation" &&
      event.payload.event !== "assessment_result"
    ) {
      // Cria o procedure no DW
      const observationID = await rds.createObservation(db_schema, observation);

      console.log(`>>> Observation ID: ${observationID[0]} <<<`);
    } else if (
      resource === "Observation" &&
      event.payload.event === "assessment_result"
    ) {
      // Score Geral
      (observation.observation_type_source_value = "Score Geral"),
        (observation.observation_source_value =
          event.payload.parameters.score_geral);
      const observationID = await rds.createObservation(db_schema, observation);
      console.log(`>>> Observation ID: ${observationID[0]} <<<`);

      // Score Vontade
      (observation.observation_type_source_value = "Score Vontade"),
        (observation.observation_source_value =
          event.payload.parameters.score_vontade);
      observationID[1] = await rds.createObservation(db_schema, observation);
      console.log(`>>> Observation ID: ${observationID[1]} <<<`);

      // Score Ansiedade
      (observation.observation_type_source_value = "Score Ansiedade"),
        (observation.observation_source_value =
          event.payload.parameters.score_ansiedade);
      observationID[2] = await rds.createObservation(db_schema, observation);
      console.log(`>>> Observation ID: ${observationID[2]} <<<`);

      // Score Sensibilidade
      (observation.observation_type_source_value = "Score Sensibilidade"),
        (observation.observation_source_value =
          event.payload.parameters.score_sensibilidade);
      observationID[3] = await rds.createObservation(db_schema, observation);
      console.log(`>>> Observation ID: ${observationID[3]} <<<`);

      // Score Medo
      (observation.observation_type_source_value = "Score Medo"),
        (observation.observation_source_value =
          event.payload.parameters.score_medo);
      observationID[4] = await rds.createObservation(db_schema, observation);
      console.log(`>>> Observation ID: ${observationID[4]} <<<`);

      // Score Raiva
      (observation.observation_type_source_value = "Score Raiva"),
        (observation.observation_source_value =
          event.payload.parameters.score_raiva);
      observationID[5] = await rds.createObservation(db_schema, observation);
      console.log(`>>> Observation ID: ${observationID[5]} <<<`);

      // Score Estabilidade
      (observation.observation_type_source_value = "Score Estabilidade"),
        (observation.observation_source_value =
          event.payload.parameters.score_estabilidade);
      observationID[6] = await rds.createObservation(db_schema, observation);
      console.log(`>>> Observation ID: ${observationID[6]} <<<`);

      // Score Cautela
      (observation.observation_type_source_value = "Score Cautela"),
        (observation.observation_source_value =
          event.payload.parameters.score_cautela);
      observationID[7] = await rds.createObservation(db_schema, observation);
      console.log(`>>> Observation ID: ${observationID[7]} <<<`);

      // Score Atenção
      (observation.observation_type_source_value = "Score Atenção"),
        (observation.observation_source_value =
          event.payload.parameters.score_atencao);
      observationID[8] = await rds.createObservation(db_schema, observation);
      console.log(`>>> Observation ID: ${observationID[8]} <<<`);

      // Score Atitude
      (observation.observation_type_source_value = "Score Atitude"),
        (observation.observation_source_value =
          event.payload.parameters.score_atitude);
      observationID[9] = await rds.createObservation(db_schema, observation);
      console.log(`>>> Observation ID: ${observationID[9]} <<<`);

      // Score Impulsos
      (observation.observation_type_source_value = "Score Impulsos"),
        (observation.observation_source_value =
          event.payload.parameters.score_impulsos);
      observationID[10] = await rds.createObservation(db_schema, observation);
      console.log(`>>> Observation ID: ${observationID[10]} <<<`);
    }

    // Disconecta do DW
    rds.disconnect();

    if (event.payload.event === "benefit_activation") {
      // Envia o evento de ativação para a Squad do APP
      const url = "https://beneficiary.samisaude.com.br/api/v1/cingulo/hook";
      const token =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiQ0lOR1VMT19BUElfSE9PSyJ9.eIm6me5RdeevbaloCkuO2NXj6R63nV-5BQHSb2vl-H4";

      await got.post(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        json: event.payload,
        responseType: "json",
      });

      console.log(">>> Enviado para a Squad do Membro <<<");
    }

    return {
      ieStatus: "S",
      dsMsgErro: "",
    };
  } catch (err) {
    utils.handleError(err);
  }
};

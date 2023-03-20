// node
const crypto = require("crypto");

// layers
const utils = require("utils.js");
const mapping = require("dataMapping");
const models = require("models");
const pgknex = require("pgknex");

// Map
const enumerator = require(`./map/enumerator`);

// modules
const dynamo = require("./modules/dynamodb");
const ssm = require("./modules/ssm");
const sqs = require("./modules/sqs");
const s3 = require("./modules/s3");
const rds = require("./modules/rds");

let env;

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  if (!event.Records || event.Records.length === 0) {
    return {
      message: "Nothing to process",
    };
  }

  // RequestId do evento no CloudWatch (Recop)
  const aws_request_id = context.awsRequestId;

  try {
    for (let index = 0; index < event.Records.length; index++) {
      // console.log(event.Records[index]);

      const body = utils.assertRequiredValue(
        "body",
        JSON.parse(event.Records[index].body),
        "object"
      );
      const schema = utils.assertRequiredValue(
        "schema",
        body.db_schema,
        "string"
      );
      const payload = utils.assertRequiredValue(
        "payload",
        body.payload,
        "object"
      );
      console.log(`>>> ${JSON.stringify(payload)} <<<`);

      env = utils.assertRequiredValue("env", body.env, "string");
      console.log(`>>> ${env} <<<`);

      // Verifica se o atendimento existe na tabela de controle
      const encounter = await dynamo.getControlTable(
        env,
        "Encounter",
        payload["Encounter"]["Id"]
      );

      // Se o atendimento já foi importado passa para a próxima iteração.
      if (encounter) continue;

      // Rotina 0 (Recop) - Hash MD5 do bundle
      const pacote = JSON.stringify(payload);
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

      const year = payload.Encounter.CloseTime.slice(0, 4);
      const month = payload.Encounter.CloseTime.slice(5, 7);
      const day = payload.Encounter.CloseTime.slice(8, 10);

      const path = `recop/ddp/ProntMed/${year}/${month}/${day}/${aws_request_id}.json`;

      // Monta as informações de envio para a TAC
      const tac = {
        hash: hash,
        id_pacote: aws_request_id,
        arquivo: `s3://sami-data-interoperabilidade/${path}`,
        status: 1,
        editor: "Lambda msImportProntmedData",
        vezes_recebido: hash_count + 1,
        id_fonte: "ProntMed",
      };

      // conecta no DW
      await rds.connect();

      // Contabilizar na TAC e armazenar na DDP se não existir
      if (hash_count === 0) {
        // Armazena na DDP (nunca foi recebido)
        await s3.recopSaveRaw(payload, path);

        // Contabiliza na TAC
        await rds.queryCreateTac(tac);
      } else {
        // Atualiza na TAC
        await rds.queryUpdateTac(hash, tac);
      }
      // desconecta do DW
      rds.disconnect();

      try {
        const { db_connection } = await ssm.getConfig();

        // Conecta no banco de dados
        models.init(
          db_connection,
          env === "prd" ? `datawarehouse` : `datawarehouse_${env}`
        );

        // Converte dados para importação DW
        const data = await mapping.convertDataMapping(
          env,
          models,
          "Prontmed",
          "episodes",
          payload,
          enumerator,
          "Import",
          "create"
        );

        // referencia o care_site_id da Prontmed no DW
        data.care_site_id = "1826";

        // ---------------------------------------------------------------------------------------------------------
        // StageTopicItem
        // ---------------------------------------------------------------------------------------------------------

        const template = payload.Encounter.Name;
        const stageTopicItem = payload.Encounter.StageTopicItem;

        console.log(`>>> Template: ${template} <<<`);
        // console.log(`>>> ${JSON.stringify(stageTopicItem)} <<<`);

        data.stage_topic_item = [];

        // percorrer o stageTopicItem e adicionar em um array no data
        for (let i = 0; i < stageTopicItem.length; i++) {
          //    Stage
          const stage = stageTopicItem[i].Stage.Label;

          //    Topic
          const topic = stageTopicItem[i].Topic.Label;

          //    Item
          const item = stageTopicItem[i].Item.Label;

          //    SubItem
          if (stageTopicItem[i].SubItem === null) {
            subitem = null;
          } else if (stageTopicItem[i].SubItem.Label) {
            subitem = stageTopicItem[i].SubItem.Label;
          }

          //  Text
          if (
            stageTopicItem[i].Text === null ||
            stageTopicItem[i].Text === ""
          ) {
            text = null;
          } else {
            text = stageTopicItem[i].Text;
          }

          //  montar o array stage_topic_item[] para inserir na transaction (data)
          data.stage_topic_item[i] = {
            stage: stage,
            topic: topic,
            item: item,
            subitem: subitem,
            text: text,
          };
        }

        // ---------------------------------------------------------------------------------------------------------
        // ---------------------------------------------------------------------------------------------------------

        if (data.providers[0].birth_at === "") {
          data.providers[0].birth_at = null;
        }

        console.log(`>>> ${JSON.stringify(data)} <<<`);

        // Executa transação de gravação nas bases de dados
        const response = await require(`./query/transaction`).execute(
          env,
          models,
          schema,
          data
        );
        console.log(">>> Realizada gravação no DW <<<");
        console.log(JSON.stringify(response));

        // if (data.life_id || response.life_id) {
        // Enviar atualização para o Hubspot
        await sqs.sendMessageToQueue(
          {
            data: {
              last_appointment: data.start_at,
            },
            id: data.life_id,
            methodType: "update",
            resourceType: "Patient",
            schema,
            env,
          },
          env
        );

        // Verifica exames solicitado da Prontmed para enviar para a Isalab
        // await checkRequestedExam(schema, response);

        // Atualiza tabela de controle
        await dynamo.updateControlTable(
          env,
          "Encounter",
          response["episode_id"],
          payload["Encounter"]["Id"],
          new Date().toISOString()
        );
        console.log(">>> Dados gravados na tabela de controle de ID's <<<");
      } catch (err) {
        console.log(JSON.stringify(err));
        throw err;
      } finally {
        models.destroy();
      }
    }

    return {
      message: "Gravação realizada com sucesso",
    };
  } catch (err) {
    utils.handleError(err);
  }
};

// Verifica exames solicitado da Prontmed para enviar para a Isalab
// async function checkRequestedExam(schema, data) {
//   const exams = require(`./map/enumerator-isalab`)["exam_isalab_enum"];

//   let checkExams = true;

//   if (data["procedures"] && data["life_id"] && data["procedures"].length > 0) {
//     data["procedures"].forEach((element) => {
//       if (!exams[element.procedure_source_value]) {
//         checkExams = false;
//         return;
//       }
//     });

//     if (checkExams) {
//       await sqs.pushMessageToQueue({
//         env,
//         schema,
//         episodeId: data["episode_id"],
//         payload: data["procedures"],
//       });

//       console.log(">>> Dados enviados para a fila da Isalab <<<");
//     }
//   }
// }

// Confere se já existe o hash
function buildQueryHash(hash) {
  const query = [];

  query.push(`select vezes_recebido from recop.tac t where hash = '${hash}' `);

  return query.join("");
}

// node
const util = require("util");
const crypto = require("crypto");

// layers
const utils = require("utils.js");
const pgknex = require("pgknex");

// modules
const dynamo = require("./modules/dynamodb");
const s3 = require("./modules/s3");
const rds = require("./modules/rds");
const docway = require("./modules/docway");

let mapping;
let providerIdExternal;
let member;

async function buildPatient(appointment, schema, data) {
  if (appointment.requester && appointment.requester.healthInsuranceNumber) {
    if (appointment.requester.healthInsuranceNumber.length === 11) {
      console.log("SELECT por CPF");
      const res = await rds.getPatientByDocument(
        schema,
        appointment.requester.healthInsuranceNumber
      );

      if (res) {
        data.appointment.life_id = res.id;
      } else {
        throw utils.buildCustomError(
          404,
          `Não encontrado pelo CPF: "${appointment.requester.healthInsuranceNumber}"`
        );
      }
    }

    if (appointment.requester.healthInsuranceNumber.length === 19) {
      console.log("SELECT por CARTEIRINHA");
      const res = await rds.getPatientByHealthInsuranceNumber(
        schema,
        appointment.requester.healthInsuranceNumber
      );
      if (res && res.id) {
        data.appointment.life_id = res.id;
      } else {
        throw utils.buildCustomError(
          404,
          `Não encontrado pela carteirinha: "${appointment.requester.healthInsuranceNumber}"`
        );
      }
    }

    if (appointment.requester.healthInsuranceNumber.length === 0) {
      console.log("SELECT por NOME");
      const res = await rds.getPatientByName(
        schema,
        appointment.requester.name
      );

      if (res) {
        data.appointment.life_id = res.id;
      } else {
        throw utils.buildCustomError(
          404,
          `Não encontrado pelo nome. Nome: "${appointment.requester.name}", Data de nascimento: "${appointment.requester.dateOfBirth}", Telefone: "${appointment.requester.phoneNumber}"`
        );
      }
    }
  }
}

async function buildDoctor(appointment, schema, data) {
  if (appointment.doctor) {
    let provider = {};

    // nome
    if (appointment.doctor.name) {
      provider.name = appointment.doctor.name;
    } else {
      throw utils.buildCustomError(400, "Nome do médico ausente");
    }

    // gênero
    if (appointment.doctor.gender || appointment.doctor.gender === 0) {
      const mapped = mapping.gender[appointment.doctor.gender.toString()];
      if (mapped) {
        for (let prop in mapped) {
          provider[prop] = mapped[prop];
        }
      }
    } else {
      throw utils.buildCustomError(400, "Gênero do médico ausente");
    }

    if (appointment.doctor.crm && appointment.doctor.crmUF) {
      provider.national_provider_identification = `${
        appointment.doctor.crm
      } - ${appointment.doctor.crmUF.toUpperCase()}`;
      data.appointment.provider_id_external = await rds.getCareSiteProvider(
        schema,
        provider,
        appointment.id
      );
      providerIdExternal = data.appointment.provider_id_external;
    } else {
      throw utils.buildCustomError(
        400,
        `CRM do médico inválido ou ausente: ${provider.national_provider_identification}`
      );
    }
  }
}

function buildSpecialty(appointment, data) {
  if (appointment.specialty && appointment.specialty.id) {
    const mapped = mapping.specialty[appointment.specialty.id.toString()];
    if (mapped) {
      for (let prop in mapped) {
        data.appointment[prop] = mapped[prop];
      }
    }
  }
}

function buildConditions(appointment, data) {
  if (
    appointment.medicalrecord.hypothesis &&
    appointment.medicalrecord.hypothesis.cids
  ) {
    data.conditions = data.conditions || [];

    for (let i = 0; i < appointment.medicalrecord.hypothesis.cids.length; i++) {
      const mapped =
        mapping.condition[
          appointment.medicalrecord.hypothesis.cids[i].cod.toString()
        ];
      if (mapped) {
        const condition = {};
        for (let prop in mapped) {
          condition[prop] = mapped[prop];
        }

        data.conditions.push(condition);
      }
    }
  }

  if (
    appointment.medicalrecord.mainSymptoms &&
    appointment.medicalrecord.mainSymptoms.length > 0
  ) {
    data.conditions = data.conditions || [];

    for (let i = 0; i < appointment.medicalrecord.mainSymptoms.length; i++) {
      const mapped =
        mapping.condition[
          appointment.medicalrecord.mainSymptoms[i].id.toString()
        ];
      if (mapped) {
        const condition = {};
        for (let prop in mapped) {
          condition[prop] = mapped[prop];
        }

        data.conditions.push(condition);
      }
    }
  }
}

function buildMeasurements(appointment, data) {
  if (appointment.medicalrecord.weight) {
    data.measurements = data.measurements || [];
    const mapped = mapping.condition["Peso"];
    if (mapped) {
      const measurement = {};
      for (let prop in mapped) {
        measurement[prop] = mapped[prop];
      }

      measurement.value = appointment.medicalrecord.weight;
      data.measurements.push(measurement);
    }
  }

  if (appointment.medicalrecord.height) {
    data.measurements = data.measurements || [];
    const mapped = mapping.condition["Altura"];

    if (mapped) {
      const measurement = {};
      for (let prop in mapped) {
        measurement[prop] = mapped[prop];
      }

      measurement.value = appointment.medicalrecord.height;
      data.measurements.push(measurement);
    }
  }

  if (appointment.medicalrecord.bodyTemperature) {
    data.measurements = data.measurements || [];
    const mapped = mapping.condition["Temperatura"];

    if (mapped) {
      const measurement = {};
      for (let prop in mapped) {
        measurement[prop] = mapped[prop];
      }

      measurement.value = appointment.medicalrecord.bodyTemperature;
      data.measurements.push(measurement);
    }
  }
}

async function getAppointment(appointmentId) {
  try {
    return await docway.getAppointmentDetails(appointmentId);
  } catch (err) {
    if (err.message) {
      if (err.message.includes("400")) {
        throw utils.buildCustomError(
          400,
          `Id do atendimento inválido: ${appointmentId}`
        );
      } else if (err.message.includes("404")) {
        throw utils.buildCustomError(
          404,
          `Atendimento não encontrado na Docway: ${appointmentId}`
        );
      } else {
        throw err;
      }
    } else {
      throw err;
    }
  }
}

function buildQueryLifeCart(schema, nrCarteirinha) {
  const query = [];

  query.push(
    `select life_id as id from ${schema}.beneficiaries b where health_card_number = '${nrCarteirinha}' `
  );

  return query.join("");
}

function buildQueryLifeCpf(schema, nrCpf) {
  const query = [];

  query.push(
    `select id from ${schema}.lives l where document_identification_primary = '${nrCpf}' `
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

  // Apenas os eventos do tipo "APPOINTMENT_FINISHED" estão vindo / Configuração pelo SSM

  try {
    if (!event.Records || event.Records.length === 0) {
      return {
        message: "Nothing to process",
      };
    }

    // RequestId do evento no CloudWatch (Recop)
    const aws_request_id = context.awsRequestId;

    // obtém parâmetros de mapeamento
    mapping = await s3.getJsonData({
      bucket: "sami-data",
      key: "docway/all/mapping.json",
    });

    // conecta no DW
    await rds.connect();

    for (let i = 0; i < event.Records.length; i++) {
      const body = utils.assertRequiredValue(
        "body",
        JSON.parse(event.Records[i].body),
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
      const env = utils.assertRequiredValue("env", body.env, "string");

      console.log(`>>> env: ${env} <<<`);
      console.log(`>>> schema: ${schema} <<<`);
      console.log(JSON.stringify(payload));

      // inicializa o módulo docway
      await docway.init(env);

      // Verifica se o atendimento existe na tabela de controle
      const encounter = await dynamo.getControl(
        "Encounter",
        env,
        payload.resource.appointment
      );

      if (encounter) {
        console.log(
          `>>> O atendimento #${payload.resource.appointment} já foi importado anteriormente <<<`
        );
        return;
      }

      // obtém os detalhes do atendimento na Docway
      const appointment = await getAppointment(payload.resource.appointment);
      appointment && (await dynamo.createAppointment(appointment, env));
      console.log(">>> Atendimento criado no Dynamo <<<");

      console.log(JSON.stringify(appointment));

      // Rotina 0 (Recop)
      // Hash MD5 do bundle
      const pacote = JSON.stringify(appointment);
      const hash = crypto.createHash("md5").update(pacote).digest("hex");
      console.log(`>>> hash: ${hash} <<<`);

      // await pgknex.connect("connection_params");
      await pgknex.connect("/Interop/igor_params"); // provisório

      // console.log(
      //   `>>> appointment.requester.healthInsuranceNumber: ${appointment.requester.healthInsuranceNumber} <<<`
      // );

      // if (appointment.requester.healthInsuranceNumber.length === 19) {
      //   // Obtém o life_id do membro pela carteirinha
      //   member = await pgknex.select(
      //     buildQueryLifeCart(
      //       schema,
      //       appointment.requester.healthInsuranceNumber
      //     )
      //   );
      // } else if (appointment.requester.healthInsuranceNumber.length === 11) {
      //   // Obtém o life_id do membro pelo CPF
      //   member = await pgknex.select(
      //     buildQueryLifeCpf(schema, appointment.requester.healthInsuranceNumber)
      //   );
      // } else {
      //   console.log(
      //     `>>> Pessoa com requester.healthInsuranceNumber = "${appointment.requester.healthInsuranceNumber}" não encontrada <<<`
      //   );
      //   continue;
      // }

      // Confere se já existe o mesmo hash na TAC
      const hash_rep = await pgknex.select(buildQueryHash(hash));

      if (hash_rep.length === 0) {
        hash_rep[0] = { vezes_recebido: 0 };
      }

      pgknex.disconnect();

      // const life_id = JSON.parse(JSON.stringify(member[0])).id;

      // console.log(`>>> life_id: ${life_id} <<<`);

      const hash_count = hash_rep[0].vezes_recebido;

      console.log(`>>> vezes_recebido: ${hash_count} <<<`);

      const year = payload.date.slice(0, 4);
      const month = payload.date.slice(5, 7);
      const day = payload.date.slice(8, 10);

      const path = `recop/ddp/DocWay/${year}/${month}/${day}/${aws_request_id}.json`;

      // Monta as informações de envio para a TAC
      const tac = {
        hash: hash,
        id_pacote: aws_request_id,
        arquivo: `s3://sami-data-interoperabilidade/${path}`,
        status: 1,
        editor: "Lambda msImportDocwayData",
        vezes_recebido: hash_count + 1,
        id_fonte: "DocWay",
      };

      // Contabilizar na TAC e armazenar na DDP se não existir
      if (hash_count === 0) {
        // Armazena na DDP (nunca foi recebido)
        await s3.recopSaveRaw(appointment, path);

        // Contabiliza na TAC
        await rds.queryCreateTac(tac);
      } else {
        // Atualiza na TAC
        await rds.queryUpdateTac(hash, tac);
      }

      //--------------------------------------------------------------------------------------

      // inicializa objeto de gravação
      let data = {
        appointment: {
          start_at: appointment.dateAppointment,
          stop_at: appointment.sellerFinalizedDate,
          care_site_id: 1825,
          id_external: appointment.id,
          provider_id_external: providerIdExternal,
        },
      };

      // constrói objeto de gravação
      await buildPatient(appointment, schema, data);
      console.log(
        `Paciente ${appointment.requester.healthInsuranceNumber} buildado`
      );

      await buildDoctor(appointment, schema, data);
      console.log(`Médico ${appointment.doctor.name} buildado`);

      buildSpecialty(appointment, data);
      console.log(`Specialty buildado`);

      buildConditions(appointment, data);
      console.log(`Conditions buildado`);

      buildMeasurements(appointment, data);
      console.log(`Measurements buildado`);

      // realiza a gravação no DW
      await rds.create(schema, data, payload.resource.appointment, env);

      console.log(JSON.stringify(data));

      console.log(
        `>>> Atendimento #${payload.resource.appointment} importado <<<`
      );

      return {
        message: "success",
      };
    }

    return;
  } catch (err) {
    utils.handleError(err);
  } finally {
    rds.disconnect();
  }
};

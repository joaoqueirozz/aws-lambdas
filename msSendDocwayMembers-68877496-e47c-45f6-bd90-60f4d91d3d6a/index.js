const http = require("./modules/http");
const misc = require("./modules/misc");
const utils = require("utils");
const util = require("util");
const dynamo = require("./modules/dynamodb");
const fs = require("fs");
const pgknex = require("pgknex");

// Layer csv-writer
var csvwriter = require("csv-writer");
var createCsvStringifier = csvwriter.createObjectCsvStringifier;

function checkImport(token, startScriptDate, env) {
  return new Promise((resolve, reject) => {
    // de minuto em minuto, tenta obter a resposta da importação
    setInterval(() => {
      http
        .checkImport(token)
        .then((check) => {
          console.log(
            util.inspect({ checkImport: check }, true, Infinity, false)
          );

          const importedDate = misc.getCustomTime(check.importedDate);
          const resDate = misc.compareDates(importedDate, startScriptDate);

          console.log({
            importedDate,
            startScriptDate,
            result: resDate,
          });

          // se a data de importação é maior que a data de início de execução do script
          // significa que a base foi importada posteriormente à execução do script
          if (resDate === 1) {
            if (check.warnings > 0) {
              http
                .getImportDetails(token, check.id)
                .then((importDetails) => {
                  console.log(
                    util.inspect({ importDetails }, true, Infinity, false)
                  );
                  reject("Erro na exportação da base");
                })
                .catch((err) => {
                  reject(err || "Erro na exportação da base");
                });
            } else {
              if (env === "prd") {
                dynamo
                  .updateHistory({
                    id: check.id,
                    date: check.importedDate,
                    filename: check.files,
                    users: check.importedRows,
                  })
                  .then(() => {
                    resolve();
                  })
                  .catch((err) => {
                    reject(err);
                  });
              } else {
                resolve();
              }
            }
          }
        })
        .catch((err) => {
          reject(err);
        });
    }, 30000); // 30 segundos
  });
}

function buildQueryLives() {
  const query = [];

  query.push(
    `select l.name, l.birth_at, l.gender_source_value, b.holder_id, lc.phone_mobile, lc.email, b.health_card_number, l.document_identification_primary, l2.document_identification_primary as document_identification_primary_2 from datawarehouse.lives l `
  );
  query.push(`inner join datawarehouse.beneficiaries b on l.id = b.life_id `);
  query.push(`left join datawarehouse.life_contacts lc on l.id = lc.life_id `);
  query.push(
    `left join datawarehouse.beneficiaries b2 on b.holder_id = b2.id `
  );
  query.push(`left join datawarehouse.lives l2 on b2.life_id = l2.id `);
  query.push(
    `where b.status_source_value = 'active' and b.start_at::date < now() `
  );

  return query.join("");
}

exports.handler = async (event, context, callback) => {
  try {
    console.log(context); // temp
    console.log(event); // temp
    console.log(callback); // temp

    console.log(">>> Envio de elegíveis para a Docway<<<");

    const startScriptDate = misc.getBrazilTime();

    await misc.sleep(5000); // 5 segundos

    await pgknex.connect("connection_params");

    // Seleciona os membros elegíveis
    const results = await pgknex.select(buildQueryLives());

    console.log(results);
    console.log(results.length);

    pgknex.disconnect();

    for (let i = 0; i < results.length; i++) {
      // Data no formato dd/mm/yyyy
      results[i].birth_at = `${results[i].birth_at
        .toISOString()
        .slice(8, 10)}/${results[i].birth_at
        .toISOString()
        .slice(5, 7)}/${results[i].birth_at.toISOString().slice(0, 4)}`;

      // Sexo no formato M ou F
      results[i].gender_source_value === "male"
        ? (results[i].gender_source_value = "M")
        : (results[i].gender_source_value = "F");

      // Titular ou Dependente
      results[i].holder_id === null
        ? (results[i].holder_id = "T")
        : (results[i].holder_id = "D");
    }

    // Definir o nome das colunas
    const csvStringifier = createCsvStringifier({
      header: [
        { id: "name", title: "Nome" },
        { id: "birth_at", title: "Nascimento" },
        { id: "gender_source_value", title: "sexo" },
        { id: "holder_id", title: "Titular ou Dependente" },
        { id: "phone_mobile", title: "Telefone" },
        { id: "email", title: "E-mail" },
        { id: "health_card_number", title: "Carteirinha" },
        { id: "document_identification_primary", title: "cpf" },
        { id: "document_identification_primary_2", title: "CPF do Titular" },
      ],
    });

    const file =
      csvStringifier.getHeaderString() +
      csvStringifier.stringifyRecords(results);

    const date = new Date();
    const year = date.toISOString().slice(0, 4);
    const month = date.toISOString().slice(5, 7);
    const day = date.toISOString().slice(8, 10);
    const today = year + month + day;

    const localFilePath = `/tmp/${today}.csv`;

    // excreve a base em um arquivo temporário
    fs.writeFileSync(localFilePath, file);

    // inicializa módulo http
    await http.init("prd");

    // obtém o token da docway
    const token = await http.getAccessToken();
    console.log(util.inspect({ token }, true, Infinity, false));

    // envia a base para a docway
    console.log({
      message: "Vai enviar para a base da Docway",
      date: new Date().toISOString(),
    });

    const result = await http.sendDatabase(
      token,
      fs.createReadStream(localFilePath)
    );

    console.log(util.inspect({ result }, true, Infinity, false));

    // await checkImport(token, startScriptDate, "prd");

    callback(null, "Finished");

    return result;
  } catch (err) {
    console.log(util.inspect(err, true, Infinity, false));
    utils.handleError(err);
  }
};

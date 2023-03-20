const ssmLib = require("aws-sdk/clients/ssm");
const ssm = new ssmLib();
const utils = require("utils");
const mapping = require("dataMapping");
const enums = require("../../map/enumerators");

const { convertPayloadHubspot } = require("../utils/auxiliary");
const {
  storeData,
  assosiateContact,
  updateData,
  getContact,
} = require("./requests");

const { insertControlTable, getControlTable } = require("../dynamo/control");
/**
 * Generate mapping data
 * @param {Object} dwData required
 * @param {Strinf} resourceType required
 * @param {Object} models required
 * @param {String} env required
 * @param {String} methodType required
 * @returns Array of objects
 */
async function formatCreate(dwData, resourceType, models, env, methodType) {
  try {
    const dataPayload = await mapping.convertDataMapping(
      env,
      models,
      "Hubspot",
      resourceType,
      dwData,
      enums,
      "Export",
      methodType
    );
    return dataPayload;
  } catch (error) {
    console.log(JSON.stringify(error));
    throw error;
  }
}

module.exports = {
  /**
   * Control create registers in Hubspot
   * @param {String} resourceType required
   * @param {Object} dwData required
   * @param {String} methodType required
   * @param {Object} hubspotIds required
   */
  async importDataHubSpot(dwData, resourceType, methodType, models, env) {
    try {
      const params = await utils.getSsmParam(ssm, "hubspot-integration-config");

      if (methodType === "create") {
        let company = await formatCreate(
          dwData.companies,
          "Organization",
          models,
          env,
          methodType
        );
        const companyExists = await getControlTable(
          "Organization",
          dwData.companies.id,
          env
        );

        let companyResponse = {};
        if (!companyExists) {
          companyResponse = await storeData(params, "company", {
            properties: company,
          });

          //Save control table
          await insertControlTable(
            "Organization",
            dwData.companies.id,
            companyResponse.id,
            companyResponse.createdAt,
            env
          );
        } else {
          companyResponse.id = companyExists.id_external;
          companyResponse.createdAt = companyExists.created;
        }

        let coverage = await formatCreate(
          dwData,
          resourceType,
          models,
          env,
          methodType
        );

        let results = [];

        // Contigência: envio de dependente sem email para evitar os emails duplicados
        // if (coverage.contratante === false) {
        //   console.log(
        //     ">>> Membro dependente: envio sem email (contingência) <<<"
        //   );
        //   coverage.email = "";
        // }

        const { email } = coverage;
        if (email) {
          const dataResopnse = await getContact(params, email);
          results = dataResopnse.results;
        }
        coverage = convertPayloadHubspot(dwData, resourceType, coverage);
        console.log(JSON.stringify(coverage));

        // a divergência com os nomes dos planos no hubspot só pode ser contornada assim (lá não tem como alterar)
        if (coverage.plano_escolhido === "Sami Antares") {
          coverage.plano_escolhido = "Sami Antares Enfermaria";
        } else if (coverage.plano_escolhido === "Sami Antares +") {
          coverage.plano_escolhido = "Sami Antares + Apartamento";
        } else if (coverage.plano_escolhido === "Sami Orion") {
          coverage.plano_escolhido = "Orion Enfermaria";
        } else if (coverage.plano_escolhido === "Sami Orion +") {
          coverage.plano_escolhido = "Orion + Apartamento";
        } else if (coverage.plano_escolhido === "Sami Coral +") {
          coverage.plano_escolhido = "Sami Coral+";
        }

        let contactResponse = null;
        if (results.length > 0) {
          console.log(">>> Contact already exist <<<");
          coverage.company_id = companyResponse.id;
          coverage.contact_id = results[0].id;
          delete coverage.email;
          contactResponse = await updateData(coverage, params);
          await insertControlTable(
            "Coverage",
            dwData.id,
            contactResponse.id,
            contactResponse.createdAt,
            env
          );
        } else {
          console.log(">>> Create contact <<<");
          console.log(JSON.stringify(coverage));
          // coverage.company_id = companyResponse.id;
          delete coverage.company_id;

          contactResponse = await storeData(params, "contact", {
            properties: coverage,
          });
        }
        // console.log(contactResponse.properties);
        // const { id } = contactResponse;
        // console.log(id);
        console.log(contactResponse["id"]);
        await assosiateContact(params, companyResponse.id, contactResponse.id);

        await insertControlTable(
          "Coverage",
          dwData.id,
          contactResponse.id,
          contactResponse.createdAt,
          env
        );
      } else {
        if (methodType === "update") {
          console.log(">>> Update contact <<<");
          const company = await getControlTable(
            "Organization",
            dwData.companies.id,
            env
          );

          let organization = null;
          let companyResponse = null;
          if (!company) {
            organization = await formatCreate(
              dwData.companies,
              "Organization",
              models,
              env,
              "create"
            );
            companyResponse = await storeData(params, "company", {
              properties: organization,
            });

            await insertControlTable(
              "Organization",
              dwData.companies.id,
              companyResponse.id,
              companyResponse.createdAt,
              env
            );
          }

          let payload = await formatCreate(
            dwData,
            resourceType,
            models,
            env,
            methodType
          );

          payload = await convertPayloadHubspot(dwData, resourceType, payload);
          const { email } = payload;
          let contactResult;
          if (email) {
            contactResult = await getContact(params, email);
          }

          if (contactResult && contactResult.results.length > 0) {
            console.log("remove this email to update");
            delete payload.email;
          }

          // a divergência com os nomes dos planos no hubspot só pode ser contornada assim (lá não tem como alterar)
          if (payload.plano_escolhido === "Sami Antares") {
            payload.plano_escolhido = "Sami Antares Enfermaria";
          } else if (payload.plano_escolhido === "Sami Antares +") {
            payload.plano_escolhido = "Sami Antares + Apartamento";
          } else if (payload.plano_escolhido === "Sami Orion") {
            payload.plano_escolhido = "Orion Enfermaria";
          } else if (payload.plano_escolhido === "Sami Orion +") {
            payload.plano_escolhido = "Orion + Apartamento";
          } else if (payload.plano_escolhido === "Sami Coral +") {
            payload.plano_escolhido = "Sami Coral+";
          }

          // Contigência: envio de dependente sem email para evitar os emails duplicados
          // if (payload.contratante === false) {
          //   console.log(
          //     ">>> Membro dependente: envio sem email (contingência) <<<"
          //   );
          //   payload.email = "";
          // }

          if (!payload.time_de_saude___ultima_consulta) {
            delete payload.time_de_saude___ultima_consulta;
          }

          const response = await updateData(payload, params);
          return { response, methodType };
        } else {
          console.log("Tipo não informado");
        }
      }
    } catch (error) {
      throw error;
    }
  },
};

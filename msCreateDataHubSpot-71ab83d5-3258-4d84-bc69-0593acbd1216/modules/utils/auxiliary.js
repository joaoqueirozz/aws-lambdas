const moment = require("moment");

function calcualteTimeCarence(dwData, payload) {
  try {
    if (dwData.grace_types) {
      const carences = {
        carencia___urgencia_emergencia: moment(payload.data_de_vigencia)
          .add(dwData.grace_types.grace_period_hospitalization || 0, "days")
          .format("DD/MM/YYYY"),
        carencia___consultas_medicas: moment(payload.data_de_vigencia)
          .add(dwData.grace_types.grace_period_appointment || 0, "days")
          .format("DD/MM/YYYY"),
        carencia___internacoes_procedimentos_especiais: moment(
          payload.data_de_vigencia
        )
          .add(dwData.grace_types.grace_period_admissions || 0, "days")
          .format("DD/MM/YYYY"),
        carencia___exames_simples: moment(payload.data_de_vigencia)
          .add(dwData.grace_types.grace_period_exam || 0, "days")
          .format("DD/MM/YYYY"),
        carencia___procedimentos_ambulatoriais: moment(payload.data_de_vigencia)
          .add(
            dwData.grace_types.grace_period_ambulatory_procedures || 0,
            "days"
          )
          .format("DD/MM/YYYY"),
        carencia___terapias: moment(payload.data_de_vigencia)
          .add(dwData.grace_types.grace_period_therapy || 0, "days")
          .format("DD/MM/YYYY"),
        carencia___exames_especiais_i: moment(payload.data_de_vigencia)
          .add(dwData.grace_types.grace_period_exam_special_I || 0, "days")
          .format("DD/MM/YYYY"),
        carencia___exames_especiais_ii: moment(payload.data_de_vigencia)
          .add(dwData.grace_types.grace_period_exam_special_II || 0, "days")
          .format("DD/MM/YYYY"),
      };

      if (dwData.lives.gender_source_value === "female") {
        carences.carencia___parto = moment(payload.data_de_vigencia)
          .add(dwData.grace_types.grace_period_childbirth || 0, "days")
          .format("DD/MM/YYYY");
      }
      return carences;
    } else {
      return {};
    }
  } catch (error) {
    console.log(error.message);
    throw error;
  }
}

module.exports = {
  /**
   * Covert dara patload and adition of fields
   * @param {Object} data required
   * @param {Strinf} resourceType required
   * @param {Object} payload required
   * @returns object data entity
   */
  convertPayloadHubspot(data, resourceType, payload) {
    try {
      if (resourceType === "Coverage") {
        const name = data.lives.name;
        const name_social = data.lives.name_social;

        if(name_social){
          if(name_social.split(' ').length <= 1) {
            payload["firstname"] = name_social.split(' ')[0];
            payload['nome_de_registro'] = name;
          } else {
            payload["firstname"] = name_social.substr(0, name_social.indexOf(" "));
            payload["lastname"] = name_social.substr(name_social.indexOf(" ") + 1);
            payload['nome_de_registro'] = name;
          }
        }else {
          payload["firstname"] = name.substr(0, name.indexOf(" "));
          payload["lastname"] = name.substr(name.indexOf(" ") + 1);
        }        
        const token =
          name_social && name_social.includes(" ")
            ? name_social.substr(0, name_social.indexOf(" "))
            : name_social || "";

        // payload["firstname"] = name.substr(0, name.indexOf(" "));
        // payload["lastname"] = name.substr(name.indexOf(" ") + 1);

        payload["token_nome"] = token.length > 0 ? token : payload["firstname"];
        payload["phone"] = payload.phone.replace(/(\d{2})(\d{9})/, "$1 $2");
        payload["contratante"] = data.contractor === true ? true : false;

        if (data.status_source_value === "draft")
          payload["hs_lead_status"] = "Pagamento realizado";
        if (data.status_source_value === "rekoved") {
          payload["hs_lead_status"] = "Cancelado";
          payload["tipo_do_contato"] = "Membro - Cancelado";
        }
        if(data.status_source_value === "cancelled") {
          payload["hs_lead_status"] = "Cancelado";
          payload["tipo_do_contato"] = "Membro - Cancelado";
        }
        
        if (data.status_source_value === "active"){
          payload["hs_lead_status"] = "Vigência ativa";
        }
      }
      payload = { ...payload, ...calcualteTimeCarence(data, payload) };
      return payload;
    } catch (error) {
      console.log(JSON.stringify(error));
    }
  },
  /**
   * Verify if integration is valid
   * @param {String} resourceType required
   * @param {Bool} patient required
   * @param {String} methodType required
   * @param {Object} data required
   * @returns Boolean
   */
  async isIntegrationHubSpot(resourceType, patient, methodType, data) {
    return (
      (resourceType === "Organization" && methodType === "create") ||
      (resourceType === "Coverage" && data["status"] !== "pending") ||
      patient
    );
  },
};

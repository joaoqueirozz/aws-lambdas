function insert(queryParameters) {
  return `BEGIN DBAPS.PRC_AUTOMACAO_USUARIO_OPS_SAMI(${
    queryParameters["cd_agrupamento_carencia"]
      ? queryParameters["cd_agrupamento_carencia"]
      : "NULL"
  },${queryParameters["cd_plano"] ? queryParameters["cd_plano"] : "NULL"},${
    queryParameters["nr_cpf"] ? queryParameters["nr_cpf"] : "NULL"
  },${
    queryParameters["dt_adesao"]
      ? `to_date('${queryParameters["dt_adesao"]}', 'dd/mm/yyyy')`
      : "NULL"
  },${
    queryParameters["cd_mat_alternativa"]
      ? `'${queryParameters["cd_mat_alternativa"]}'`
      : "NULL"
  },'${queryParameters["sn_ativo"]}'); END;`;
}

module.exports = {
  insert
};

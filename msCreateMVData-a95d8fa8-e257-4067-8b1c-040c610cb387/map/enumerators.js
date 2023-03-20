module.exports = {
  payment_method_enum: {
    unknown: {
      // Esposo(a)
      tp_cobranca: "N",
    },
    1: {
      // Filho(a)
      tp_cobranca: "N",
    },
    2: {
      // Outro
      tp_cobranca: "N",
    },
    3: {
      // Não Parente
      tp_cobranca: "B",
    },
    4: {
      // Pais
      tp_cobranca: "N",
    },
    5: {
      // Irmão
      tp_cobranca: "N",
    },
  },
  status_enum: {
    active: {
      //SIM
      snAtivo: "S",
    },
    draft: {
      //SIM
      snAtivo: "S",
    },
    pending: {
      //SIM
      snAtivo: "S",
    },
    cancelled: {
      //NÃO
      snAtivo: "N",
    },
    "entered-in-error": {
      //NÃO
      snAtivo: "N",
    },
    unknown: {
      //SIM
      snAtivo: "S",
    },
  },
  marital_status_enum: {
    1: {
      //Solteiro
      tpEstadoCivil: "S",
    },
    2: {
      //Casado
      tpEstadoCivil: "C",
    },
    3: {
      //Divorciado/Separado
      tpEstadoCivil: "D",
    },
    4: {
      //Viúvo
      tpEstadoCivil: "V",
    },
    5: {
      //Outros
      tpEstadoCivil: "S",
    },
    unknown: {
      //Outros
      tpEstadoCivil: "S",
    },
  },
  gender_enum: {
    male: {
      //Masculino
      tpSexo: "M",
    },
    female: {
      //Feminino
      tpSexo: "F",
    },
    unknown: {
      //Null
      tpSexo: "",
    },
  },
  health_plan_price_enum: {
    1: 1, // Sol Enfermaria Porte I
    2: 7, // Sol Enfermaria Porte II
    3: 1, // Sol Apartamento Porte I
    4: 21, // Sol Apartamento Porte II
    5: 8, // Antares Enfermaria Porte I
    6: 9, // Antares Enfermaria Porte II
    7: 10, // Antares Apartamento Porte I
    8: 11, // Antares Apartamento Porte II
    9: 17, // Orion Enfermaria Porte I
    10: 18, // Orion Enfermaria Porte II
    11: 19, // Orion Apartamento Porte I
    12: 20, // Orion Apartamento Porte II
    13: 40, // Coral Apartamento Porte I
    14: 41, // Coral Apartamento Porte II
    15: 42, // Coral Apartamento Porte III - Adesão
    16: 43, // Coral Apartamento Porte III - Compusório
    17: 48, // Celeste Enfermaria Porte I
    18: 49, // Celeste Enfermaria Porte II
    19: 50, // Celeste Enfermaria Porte III
    21: 51, // Celeste Apartamento Porte I
    22: 52, // Celeste Apartamento Porte II
    23: 53, // Celeste Apartamento Porte III
    25: 54, //Antares Enfermaria Porte II
    26: 55, //Antares Enfermaria Porte III
    27: 56, //Antares Apartamento Porte II
    28: 57, //Antares Apartamento Porte III
    29: 58, //Orion Enfermaria Porte I
    30: 59, //Sol Enfermaria Porte III
    31: 60, //Orion Enfermaria Porte III
    32: 61, //Orion Apartamento Porte I
    33: 62, //Orion Apartamento Porte II
    34: 63, //Orion Apartamento Porte III
    35: 64, //Sol Enfermaria Porte I
    36: 65, //Sol Enfermaria Porte II
    37: 66, //Sol Enfermaria Porte III
    38: 67, //Sol Apartamento Porte I
    39: 68, //Sol Apartamento Porte II
    40: 69, //Sol Apartamento Porte III
    42: 70, //Antares Enfermaria Porte II
    43: 71, //Antares Enfermaria Porte III
    44: 72, //Antares Apartamento Porte I
    45: 73, //Antares Apartamento Porte II
    46: 74, //Antares Apartamento Porte III
    47: 75, //Orion Enfermaria Porte I
    48: 76, //Orion Enfermaria Porte II
    49: 77, //Antares Enfermaria Porte III
    50: 78, //Orion Apartamento Porte I
    51: 79, //Orion Apartamento Porte II
    52: 80,  //Orion Apartamento Porte III
    54: 82, //Sol Enfermaria Porte I
    55: 83, //Sol Enfermaria Porte II
    56: 84, //Sol Enfermaria Porte III
    57: 85, //Sol Apartamento Porte I
    58: 86, //Sol Apartamento Porte II
    59: 87, //Sol Apartamento Porte III
    60: 103, //Antares Enfermaria Porte I
    61: 107, //Antares Enfermaria Porte II
    62: 104, //Antares Enfermaria Porte III
    63: 105, //Antares Apartamento Porte I
    63: 106, //Antares Apartamento Porte II
    64: 108 //Antares Apartamento Porte III
  },
  health_plan_enum: {
    1: {
      tp_registro: 1,
      cd_plano: 1,
      cd_grupo_faixa_etaria: 2,
    }, // Sami Sol Enfermaria
    2: {
      tp_registro: 1,
      cd_plano: 4,
      cd_grupo_faixa_etaria: 2,
    }, // Sami Sol Apartamento
    3: {
      tp_registro: 1,
      cd_plano: 5,
      cd_grupo_faixa_etaria: 2,
    }, // Sami Antares
    4: {
      tp_registro: 1,
      cd_plano: 6,
      cd_grupo_faixa_etaria: 2,
    }, // Sami Antares +
    5: {
      tp_registro: 1,
      cd_plano: 7,
      cd_grupo_faixa_etaria: 2,
    }, // Sami Orion
    6: {
      tp_registro: 1,
      cd_plano: 8,
      cd_grupo_faixa_etaria: 2,
    }, // Sami Orion +
    7: {
      tp_registro: 1,
      cd_plano: 11,
      cd_grupo_faixa_etaria: 2,
    }, // Sami Coral +
    8: {
      tp_registro: 1,
      cd_plano: 12,
      cd_grupo_faixa_etaria: 2,
    }, // Sami Celeste
    9: {
      tp_registro: 1,
      cd_plano: 13,
      cd_grupo_faixa_etaria: 2,
    }, // Sami Celeste +
    10: {
      tp_registro: 1,
      cd_plano: 9,
      cd_grupo_faixa_etaria: 2,
    }, // Sami Antares
    11: {
      tp_registro: 1,
      cd_plano: 10,
      cd_grupo_faixa_etaria: 2,
    }, //Sami Antares +
  },
};

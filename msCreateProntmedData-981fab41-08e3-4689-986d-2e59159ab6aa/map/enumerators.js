module.exports = {
    "relationship_types_enum": {
        '1': { // Esposo(a)
            "tipoRelacionamento": 0
        },
        '2': { // Filho(a)
            "tipoRelacionamento": 1
        },
        '3': { // Outro
            "tipoRelacionamento": 2
        },
        '4': { // Não Parente
            "tipoRelacionamento": 3
        },
        '5': { // Pais 
            "tipoRelacionamento": 4
        },
        '6': { // Irmão
            "tipoRelacionamento": 5
        },
        'unknown': { //Null
            "tipoRelacionamento": ""
        }
    },
    "marital_status_enum": {
        '1': { //Solteiro
            "estadoCivil": "S"
        },
        '2': { //Casado
            "estadoCivil": "C"
        },
        '3': { //Divorciado/Separado
            "estadoCivil": "D"
        },
        '4': { //Viúvo
            "estadoCivil": "V"
        },
        '5': { //Outros
            "estadoCivil": "O"
        },
        'unknown': { //Null
            "estadoCivil": ""
        }
    },
    "gender_enum": {
        'male': { //Masculino
            "sexo": "M"
        },
        'female': { //Feminino
            "sexo": "F"
        },
        'unknown': { //Null
            "sexo": ""
        }
    },
    "status_enum": {
        'active': {
            "arquivado": false
        },
        'draft': {
            "arquivado": true
        },
        'cancelled': {
            "arquivado": true
        },
        'pending': {
            "arquivado": true
        },
        'revoked': {
            "arquivado": true
        }
    }
}
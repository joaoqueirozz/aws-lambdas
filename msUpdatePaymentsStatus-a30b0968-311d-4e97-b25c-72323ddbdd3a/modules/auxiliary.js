module.exports = {
  formatStatus(status) {
    return {
      paid: "Pago",
      canceled: "Cancelado",
      pending: "Pendente",
      issued: "Emitido",
      rejected: "Rejeitado",
      refund: "Reembolsado",
    }[status];
  },
};

// 'CANCELED', 'PENDING', 'ISSUED', 'PAID', 'REJECTED', 'REFUND', 'INVALID'

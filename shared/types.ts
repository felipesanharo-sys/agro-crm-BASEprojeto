/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

export type ClientStatus = "ativo" | "em_ciclo" | "alerta" | "pre_inativacao" | "inativo";
export type ActionStatus = "em_acao" | "pedido_na_tela" | "excluido" | "reset";

export const COLUMN_MAP: Record<string, string> = {
  "Ano": "year",
  "Ano.Mês": "yearMonth",
  "Mês": "month",
  "Data de Faturamento": "invoiceDate",
  "Origem_": "origin",
  "Gerência Regional": "regionalManagement",
  "Gerência Distrital": "districtManagement",
  "Supervisão": "supervision",
  "Microrregião": "microRegion",
  "Representante": "repName",
  "Código Representante": "repCode",
  "Status Representante": "repStatus",
  "Código Cliente Datasul": "clientCodeDatasul",
  "Código Cliente SAP": "clientCodeSAP",
  "Código Agrupamento Cliente SAP": "clientGroupCodeSAP",
  "Nome Cliente": "clientName",
  "Nome Matriz Cliente": "clientParentName",
  "Cidade Cliente": "clientCity",
  "UF Cliente": "clientState",
  "Endereço Cliente": "clientAddress",
  "Telefone Cliente": "clientPhone",
  "CNPJ/CPF": "clientDocument",
  "ATC Responsável": "atcResponsible",
  "Canal de Vendas": "salesChannel",
  "Canal de Vendas Agrupado": "salesChannelGroup",
  "Classificação PITT": "pittClassification",
  "Código Produto Datasul": "productCodeDatasul",
  "Código Produto SAP": "productCodeSAP",
  "Nome Produto": "productName",
  "Categoria Produto": "productCategory",
  "Produto Tecnológico": "productTechnological",
  "Programa Produto": "productProgram",
  "Fórmula Especial": "specialFormula",
  "Tipo de Frete": "freightType",
  "Pedido Código": "orderCode",
  "Pedido Item": "orderItem",
  "Kg Faturado": "kgInvoiced",
  "R$ Faturado SEM impostos": "revenueNoTax",
  "R$ Faturado COM impostos": "revenueWithTax",
  "Referência": "reference",
  "Data Implantação": "implantationDate",
  "Data Fixação de Preço": "priceFixDate",
  "Precision Farming": "precisionFarming",
};

export const REQUIRED_COLUMNS = [
  "Data de Faturamento",
  "Representante",
  "Código Representante",
  "Nome Cliente",
  "Nome Produto",
  "Pedido Código",
  "Pedido Item",
  "Kg Faturado",
];

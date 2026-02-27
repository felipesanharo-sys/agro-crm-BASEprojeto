# Agro CRM BA03 - TODO

## Backend - Schema & Database
- [x] Tabela invoices (faturamento CSV) com todas as colunas do original
- [x] Tabela rep_aliases (aliases de RCs com parentRepCode e isGestor)
- [x] Tabela client_actions (ações manuais de status)
- [x] Tabela sales_goals (metas mensais)
- [x] Tabela rc_invites (convites de onboarding)
- [x] Tabela notifications (notificações do sistema)
- [x] Tabela upload_logs (log de uploads)
- [x] Tabela page_views (tracking de atividade)
- [x] Coluna repCode na tabela users

## Backend - API Routes (réplica fiel do original)
- [x] Upload CSV/XLSX com parsing xlsx, deduplicação por mês, backup S3
- [x] Dashboard: métricas agregadas, evolução mensal, RC ranking
- [x] Clientes: listagem com ciclo de compra, status automático, benchmarking
- [x] Clientes: ações manuais (em_acao, pedido_na_tela, excluido, reset)
- [x] Clientes: detalhes (últimos pedidos, breakdown produtos, histórico ações)
- [x] Histórico: evolução 12 meses, ranking clientes, ranking produtos, RC ranking
- [x] Aceleração: programa aceleração com categorias (Master, Esp. Plus, Especial, Essencial)
- [x] Produtos: volume por produto, evolução temporal, clientes por produto
- [x] Rep aliases: CRUD com parentRepCode e isGestor
- [x] Sales goals: CRUD para metas mensais
- [x] Convites: gerar, consultar e aceitar convites com vinculação automática
- [x] Notificações: listagem, contagem não lidas, marcar como lidas
- [x] Atividade: tracking de page views, resumo de atividade por usuário
- [x] Export: exportação de invoices e anotações
- [x] Manager: relatório de conversão, resumo por RC, anotações
- [x] Filtro por RC em todas as queries (admin vê tudo, RC vê só seus dados)

## Frontend - Layout & Design (réplica fiel do original)
- [x] Tema verde profissional com status badge colors
- [x] DashboardLayout com sidebar (desktop) e bottom nav (mobile)
- [x] Sidebar resizável com drag handle
- [x] Navegação: Clientes, Histórico, Aceleração, Produtos, Upload, Usuários, Notificações

## Frontend - Páginas (copiadas do original)
- [x] ClientsPage: Ranking Saúde + Lista de Clientes com detalhes expandíveis
- [x] HistoryPage: evolução mensal, ranking clientes/produtos, RC ranking
- [x] AceleracaoTab: programa aceleração com categorias e breakdown mensal
- [x] ProductsPage: análise de volume, evolução, clientes por produto
- [x] UploadPage: upload CSV/XLSX com preview e logs
- [x] SettingsPage: aliases de RCs e metas
- [x] UsersPage: gestão de usuários e atividade
- [x] NotificationsPage: listagem de notificações com filtros
- [x] InvitePage: aceite de convite com vinculação ao repCode

## Controle de Acesso
- [x] Sistema de convites com token e vinculação ao repCode
- [x] OAuth returnPath para redirect correto após login
- [x] Filtro rigoroso por repCode em todas as queries
- [x] adminProcedure para rotas exclusivas de gestores
- [x] parentRepCode para consolidação de dados

## Removido (não aplicável ao BA03)
- [x] Aba Previsão de Vendas (sem Google Sheets)
- [x] Funnel/Funil de vendas (sem Google Sheets)
- [x] Integração Google Sheets (sem planilha de acompanhamento)

## Testes
- [x] Testes de controle de acesso (admin, RC, unauthenticated)
- [x] Testes de lógica de ciclo de compra
- [x] Testes de parsing de datas e números brasileiros
- [x] Testes de formatação yearMonth
- [x] 14 testes passando

# IDG — Auditoria e liberação (30/10/2026)

**Status: NÃO APROVADO para publicação definitiva.** Auditoria parcial; não houve testes de invasão nem de perfis cruzados. Logs sem evidência confirmada de incidente não provam ausência de vazamento.

## Verificado
- 26 tabelas públicas com RLS habilitado.
- `idg_course_registrations`: 63 registros; RLS ativo e sem políticas diretas, acesso por cliente comum bloqueado por padrão.
- Cinco funções SECURITY DEFINER sinalizadas pelo Security Advisor. Há verificações internas de papéis nas funções examinadas, mas faltam testes efetivos com diferentes usuários.
- Proteção contra senhas vazadas desativada.
- Dez respostas HTTP 403 na rota de usuário do Auth, originadas do mesmo IP na janela consultada; não comprova ataque.
- Frontend inspecionado utiliza chave publicável; não houve auditoria completa do histórico de commits.
- `submit-application` usa Turnstile e validação no servidor.

## Mudança em código ainda não implantada
A Edge Function `submit-application` foi alterada para permitir a origem `IDG_ALLOWED_ORIGIN`, com padrão `https://melanysi.github.io`, e recusar origens divergentes. Exige implantação separada e testes de regressão. CORS **não** substitui autenticação nem controle de abuso.

## Bloqueadores
1. Testar RLS e as funções privilegiadas com contas fictícias de anônimo, aluno, parceiro, coordenador e administrador, inclusive tentativas de acesso cruzado.
2. Verificar proteção de dados pessoais, dados de menores, privacidade, consentimento, retenção e exclusão (LGPD).
3. Revisar Storage, autenticação, recuperação de senha, redirecionamentos, segredos e logs.
4. Ativar proteção contra senhas comprometidas, se disponível.
5. Implantar e testar a Edge Function em ambiente de teste antes de produção.
6. Testar integralmente formulários, portais, Sol, IDG Daily, navegação, acessibilidade e dispositivos móveis.
7. Confirmar HTTPS, backups/restauração, monitoramento e rollback.

**Critério de liberação:** zero vulnerabilidades críticas ou altas conhecidas em aberto, testes de acesso e fluxos principais aprovados, plano de recuperação e autorização expressa para publicar.

Referências: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable e https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

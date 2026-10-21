# Simulador de Logística SENAI

Laboratório de equipamentos 3D com oito setores, operação interativa, automática e manual. Escolha entre panela de cabo 18 cm, caçarola 24 cm e frigideira 24 cm no painel à direita. O modelo acompanha cada unidade até a expedição e aparece no relatório. Trocar o modelo prepara um novo lote.

## Executar

Requer Node.js 24 ou superior. Instale com `npm install` e execute `npm run dev`. O comando inicia a API de autenticação na porta 3001 e o Vite em http://127.0.0.1:5173. Abra **esse endereço**, crie uma conta e entre. Não use um servidor de arquivos estáticos isolado: o login precisa da API.

Para executar separadamente: `npm run dev:api` e `npm run dev:client`. Se a porta 5173 estiver ocupada, encerre a instância anterior: uma porta alternativa também exige atualizar APP_ORIGIN. O proxy Vite envia /api para a API local preservando a origem.

## Autenticação e recuperação

Cadastro, login e saída funcionam com JWT assinado via jose em cookie HttpOnly, senha com scrypt e contas em SQLite. O login é verificado antes de abrir o simulador. A troca de senha invalida sessões anteriores. Os dados privados ficam em `.local/auth`, fora do Git e da pasta pública.

Para enviar e-mails, copie `.env.example` para `.env` e configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD e SMTP_FROM. Reinicie o servidor. Sem SMTP, **somente em desenvolvimento**, os e-mails de recuperação são salvos como arquivos `.eml` em `.local/auth/mail`; abra o arquivo mais recente e use seu link. Nenhum e-mail real é enviado nesse modo. Os links expiram em 20 minutos e funcionam uma vez.

Em produção, é necessário um serviço Node persistente, HTTPS e proxy de `/api` no mesmo domínio da página. Configure NODE_ENV=production, APP_ORIGIN, AUTH_JWT_SECRET aleatório de pelo menos 32 bytes e SMTP real. `npm run build` gera os arquivos do cliente em dist; `npm start` inicia apenas a API. Consulte [server/README.md](server/README.md) para configuração e limites. O cadastro ainda não verifica a posse do e-mail.

## Conduzir a simulação

O modo Interativo é o padrão. Ao entrar na conta, o simulador abre no Recebimento; clique em Iniciar para começar o ciclo. O modo Interativo continua disponível: nele, use o botão da cena ou do painel para autorizar uma operação por vez. A máquina termina essa operação e espera o próximo comando. Na linha integrada em modo Interativo, passe pelos setores para liberar as operações quando receberem material. A montagem de cabo/alças faz parte da produção. Sensores, proteção, obstrução e emergência afetam o ciclo. Não há conexão com CLP externo nesta versão.

## Verificar

`npm test` verifica autenticação, recuperação, segurança, modelos e fluxo de materiais. `npm run build` valida a versão de distribuição.

### Cadastro de alunos e tentativas

Novos cadastros exigem matrícula única (3–30 letras, números ou hífens), preservando zeros à esquerda. O login continua com e-mail e senha. Contas anteriores são preservadas pela migração do banco. A senha mínima no cadastro e na recuperação é de 8 caracteres (máximo 128). A matrícula informada não é consultada em uma base oficial do SENAI.

O servidor limita tentativas de login, cadastro e recuperação, além do total por origem de conexão. Ao receber HTTP 429, o formulário aguarda o prazo `Retry-After` e mostra a contagem para tentar novamente. Os limites são aplicados no servidor mesmo se o formulário for contornado. Veja server/README.md para os valores e limites operacionais.


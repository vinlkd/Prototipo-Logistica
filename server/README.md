# Autenticação do simulador

Requer Node.js 24 ou mais recente e as dependências `jose` e `nodemailer`.
O banco SQLite é persistido fora da pasta pública em `.local/auth/auth.sqlite`.
Inclua `.local/` e `.env` no `.gitignore`. Nunca publique os dados, chaves ou e-mails de desenvolvimento.

## Execução

Na raiz do projeto, execute `node server/index.js` em um terminal e o Vite em outro.
O Vite deve encaminhar `/api` para `http://127.0.0.1:3001` com o mesmo Origin do navegador.
A API não oferece CORS; o navegador usa a mesma origem por meio desse proxy.

Para configurar ambiente, copie `server/.env.example` para `server/.env` e execute:

```text
node --env-file=server/.env server/index.js
```

`AUTH_JWT_SECRET` precisa ter no mínimo 32 bytes aleatórios. Em desenvolvimento,
sem essa variável, uma chave é gerada e persistida em `.local/auth/jwt-secret`.
Ela não é substituída a cada reinício. Não use variáveis `VITE_` para segredos.

## Contrato JSON

Todas as mutações exigem `Origin` igual a `APP_ORIGIN` e
`X-Requested-With: Logistica`. Envie `Content-Type: application/json` e
`credentials: 'same-origin'` nos fetches pelo proxy. Fora de produção, sem
APP_ORIGIN explícito, localhost:5173 e 127.0.0.1:5173 são permitidos.

| Método e rota | Entrada | Sucesso |
| --- | --- | --- |
| POST `/api/auth/register` | `{name,email,enrollment,password}` | 201 `{user}` e cookie |
| POST `/api/auth/login` | `{email,password}` | 200 `{user}` e cookie |
| GET `/api/auth/me` | — | 200 `{user}` ou 401 |
| POST `/api/auth/logout` | — | 200 `{message}` e cookie removido |
| POST `/api/auth/forgot-password` | `{email}` | 200 `{message}` genérica |
| POST `/api/auth/reset-password` | `{token,password}` | 200 `{message}` |

`user` contém somente `{id,name,email,enrollment}`. Erros usam `{error}` e status apropriado.
Senha: 8 a 128 caracteres, sem regras artificiais de símbolos; espaços são preservados.
Nome: até 80 caracteres. E-mail é normalizado para minúsculas.

JWT HS256 é assinado/verificado por `jose`, com emissor, público, prazo e
algoritmo fixos. O cookie `logistica_session` usa HttpOnly, SameSite=Strict,
Path=/api e duração de oito horas. Em produção ou HTTPS também usa Secure.
Há registro persistente de sessões, portanto logout revoga o cookie antigo
mesmo se ele for reapresentado. A troca de senha revoga todas as sessões da conta.
As senhas usam scrypt N=131072, r=8, p=1, salt aleatório por senha.

## Recuperação

O token tem 32 bytes aleatórios; só seu SHA-256 é gravado no banco. Expira em
20 minutos e é consumido atomicamente uma única vez. O link usa
`APP_ORIGIN/?resetToken=...`. O frontend deve remover o parâmetro do endereço
com `history.replaceState`, não registrar o token e definir Referrer-Policy
no-referrer na página de autenticação. A API nunca devolve o token.

Em desenvolvimento sem SMTP, a mensagem fica somente em
`.local/auth/mail/*.eml`, acessível ao desenvolvedor no disco. Abra o arquivo
local para testar o link; não há endpoint para listar ou ler essas mensagens.
Isso não entrega e-mails reais. Em Windows, mantenha a pasta sob a conta do
usuário: as permissões POSIX solicitadas pelo Node não substituem ACLs NTFS.

Para envio real, configure `SMTP_HOST`, `SMTP_PORT` (587 padrão, 465 para TLS
implícito), `SMTP_USER`, `SMTP_PASSWORD` e `SMTP_FROM`. As conexões SMTP usam
TLS ou exigem STARTTLS, sem desligar a validação de certificados. Falhas de envio
geram aviso genérico no servidor, sem expor e-mail/token no log ou resposta.

## Publicação e limites

Produção exige `NODE_ENV=production`, `APP_ORIGIN=https://seu-dominio`,
`AUTH_JWT_SECRET` e SMTP. Hospede Node em serviço persistente e encaminhe `/api`
no mesmo domínio pelo proxy HTTPS. Só publicar `dist` em hospedagem estática
não executa esta API. Faça backup do SQLite e proteja o diretório de dados.

Rate limiting usa memória do processo, por endereço do peer e também e-mail
para login. Cabeçalhos X-Forwarded-For não são confiados automaticamente. Atrás
de proxy, todos os clientes podem compartilhar os limites do peer: configure
limitação por IP no proxy para implantação maior. Uma instância local é o alvo
desta implementação; múltiplas instâncias precisam de limites compartilhados e
de uma estratégia de banco/sessão apropriada. O cadastro não verifica a posse do
e-mail; verificação de endereço e controle de acesso por turma ficam fora deste fluxo.

Referências: [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html),
[Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html),
[Node SQLite](https://nodejs.org/api/sqlite.html).

## Matrícula e limites de tentativas

Novos cadastros exigem `enrollment` como **string** de 3 a 30 caracteres:
letras A–Z/a–z, números e hífen. Espaços externos são removidos; zeros iniciais
são preservados. A matrícula é única sem distinguir maiúsculas de minúsculas.
Não representa validação com uma base oficial do SENAI. O login continua por
**e-mail e senha**. `user.enrollment` é devolvido no cadastro, login e `/me`.
A migração adiciona a coluna de forma não destrutiva: contas anteriores mantêm
`enrollment: null`, suas senhas e sessões, sem exigir matrícula no login.

Todos os limites abaixo usam janela fixa. Ao exceder, a API devolve **429**,
`{error}` e `Retry-After` em segundos até a liberação da janela. Solicitações
inválidas também contam; o cliente não deve reenviar automaticamente.

| Limite | Quantidade | Janela |
| --- | --- | --- |
| Todos os pedidos de autenticação por peer | 180 | 1 minuto |
| Todas as mutações por peer | 45 | 1 minuto |
| Cadastro por peer | 5 | 15 minutos |
| Login por peer | 20 | 15 minutos |
| Login por e-mail normalizado | 10 | 15 minutos |
| Recuperação por peer | 10 | 15 minutos |
| Redefinição por peer | 12 | 15 minutos |

A recuperação ainda envia no máximo uma mensagem por conta por minuto,
sem revelar se a conta existe. Os limites continuam em memória e reiniciam com
o processo; para múltiplas instâncias aplique também limitação compartilhada no
proxy. O frontend deve respeitar `Retry-After` e permitir nova tentativa após
o prazo. A senha mínima para novos cadastros e redefinições é 8 caracteres;
o máximo permanece 128. O algoritmo de hash e a proteção de sessão não mudaram.

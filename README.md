# export-codigo-rastreio

![Node](https://img.shields.io/badge/Node.js-22%2B-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-36-47848F?logo=electron&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite&logoColor=white)
![Vitest](https://img.shields.io/badge/tests-vitest-6E9F18?logo=vitest&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

Programa único (Windows) que captura automaticamente os códigos de rastreio dos Correios (formato `NN000000000BR`) enviados por um fornecedor num grupo do Telegram, e mostra o status de cada um numa tela, consultado sob demanda na API do PacoteVício.

## Como funciona

1. Você, o fornecedor e um bot do Telegram estão num grupo.
2. Ao abrir o programa, ele passa a escutar as mensagens do grupo (long polling) e extrai qualquer código no formato `NN000000000BR`, salvando num banco local (sem duplicar).
3. A tela mostra todos os pacotes já capturados, filtráveis por Aguardando / Em trânsito / Entregue.
4. Ao clicar em **"Atualizar"**, consulta a [API do PacoteVício](https://pacotevicio.dev/) pra cada pacote ainda ativo (não entregue) e atualiza status, previsão de entrega e histórico completo de eventos. Quando um pacote é marcado como entregue, ele para de ser consultado nos próximos refreshes.
5. Clicar num pacote na tabela abre os detalhes: tipo do pacote, previsão de entrega e o histórico completo.
6. Fechar a janela (X) **não encerra o programa**: ele continua na bandeja do sistema (perto do relógio), ainda escutando o grupo. Clique com o botão direito no ícone da bandeja pra reabrir a tela ou sair de vez. O programa também abre sozinho quando o Windows liga.

A consulta na API só acontece quando alguém aperta "Atualizar"; não tem polling automático nem notificação por DM, pra economizar a cota gratuita do RapidAPI (1.000 requisições/mês).

## Setup manual (fazer uma vez, fora do código)

### 1. Criar o bot

No Telegram, fale com [@BotFather](https://t.me/BotFather):

```
/newbot
```

Siga as instruções e guarde o **token** gerado (`BOT_TOKEN`).

### 2. Desativar o "privacy mode" do bot

Por padrão, bots em grupo só recebem mensagens que começam com `/`. Como precisamos que ele veja todas as mensagens (os códigos de rastreio), desative isso:

```
/setprivacy
```

Selecione o bot e escolha **Disable**.

### 3. Criar o grupo e pegar o chat_id

1. Crie um grupo novo no Telegram com você e o fornecedor.
2. Adicione o bot criado no passo 1 a esse grupo.
3. Mande uma mensagem de teste no grupo (ex: `teste`).
4. Abra no navegador (substituindo `<TOKEN>` pelo seu token):
   ```
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```
5. No JSON retornado, procure o `chat.id` da mensagem que você mandou no grupo → esse é o `SUPPLIER_GROUP_CHAT_ID` (vai ser um número negativo).

### 4. Pegar a chave da API PacoteVício

1. Crie uma conta em [rapidapi.com](https://rapidapi.com).
2. Procure pela API **"Correios - Rastreamento De Encomendas"** (é a API do PacoteVício, listada com esse nome no marketplace) e assine o plano gratuito (Basic).
3. Copie a chave (`X-RapidAPI-Key`) → `RAPIDAPI_KEY`.

> A resposta real da API foi validada em [`src/tracking/pacotevicio.ts`](src/tracking/pacotevicio.ts): os dados do rastreio vêm aninhados em `correios_object.eventos`, e a entrega é detectada pelo campo `correios_object.temEventoEntrega`. Quando o código consultado não é encontrado (ou está fora do período que os Correios mantêm o histórico), a API responde com `{"erro": true, "mensagem": "..."}`, tratado como "sem atualização ainda".

## Desenvolvimento

Pré-requisito: Node.js 22+.

```bash
npm install
cp .env.example .env   # preencha BOT_TOKEN, SUPPLIER_GROUP_CHAT_ID, RAPIDAPI_KEY
npm run dev             # compila e abre o app Electron
```

## Testes

```bash
npm test
npm run typecheck
```

Cobre a extração de códigos por regex, a classificação de status (`categorize`) e o parsing da resposta da API PacoteVício (com fetch mockado).

## Gerando o programa pra entregar (`.exe` único, sem instalador)

```bash
npm run dist
```

Gera `release/Rastreio de Encomendas <versão>.exe`, um `.exe` portátil (não precisa instalar, não pede admin). Pra entregar:

1. Coloque esse `.exe` e o seu `.env` preenchido (com os valores reais do setup acima) **na mesma pasta**.
2. Zipe a pasta inteira (o `.env` não pode ir sem estar zipado/pertinho do `.exe`, senão o programa não encontra as credenciais).
3. Mande o zip pra quem for usar. A pessoa só precisa extrair e dar duplo clique no `.exe`.

> **Nota:** como é um `.exe` sem assinatura digital, o Windows SmartScreen pode avisar "O Windows protegeu o computador" no primeiro clique. É só clicar em **"Mais informações" → "Executar assim mesmo"**.

## Painel

O painel só lê o que já está salvo no banco ao abrir (rápido, sem gastar cota da API). O botão **"Atualizar"** é quem de fato consulta a API do PacoteVício pra cada pacote ativo; por isso pode demorar alguns segundos, e é a única hora em que uma requisição é gasta.

Categorias:

- **Aguardando**: código capturado, a API ainda não retornou nenhum evento pra ele.
- **Em trânsito**: já tem evento(s), mas ainda não foi entregue.
- **Entregue**: `delivered_at` preenchido (mesmo critério que para de consultar).

## Estrutura

```
src/
├── config.ts                  # le .env (compativel com .exe portatil, ver PORTABLE_EXECUTABLE_DIR) e valida as variaveis obrigatorias
├── db/
│   ├── index.ts                 # SQLite: schema + migrações leves + queries da tabela packages
│   └── packageCategory.ts       # PackageRow/categorize() -- funcao pura, sem tocar no banco (por isso e testavel fora do Electron)
├── telegram/
│   ├── bot.ts                   # instancia compartilhada do bot (grammy)
│   ├── listener.ts              # escuta o grupo e extrai codigos
│   └── codeExtractor.ts         # regex de extracao (testavel isoladamente)
├── tracking/pacotevicio.ts     # cliente da API PacoteVicio
└── poller.ts                    # pollOnce(): consulta status pra cada pacote ativo (chamado sob demanda)

desktop/                         # app Electron -- unico processo, roda o bot e a tela juntos
├── main.ts                       # inicia o listener do Telegram, cria janela + bandeja, expoe IPC "packages:list"/"packages:refresh" chamando src/ direto
├── preload.ts                     # contextBridge: expoe window.api.listPackages()/refreshPackages()
├── renderer/                      # HTML/CSS/JS puro (tabela + filtros + dialog de detalhes)
└── assets/                        # icone do app/bandeja (icon.ico, tray.png)
```

## Padrões

- **Repository** (`src/db/index.ts`): `PackageRepository` concentra o schema, as migrações e os prepared statements da tabela `packages` num único ponto de acesso, em vez de statements soltos no módulo.
- **Provider** (`src/tracking/pacotevicio.ts`): a interface `TrackingProvider` separa "consultar o status de um rastreio" de "como a API do PacoteVício responde"; `poller.ts` depende só da interface.
- Canais de IPC entre o processo principal e a janela ficam centralizados em `desktop/ipcChannels.ts`, usado tanto por `main.ts` quanto por `preload.ts`.

## Licença

[MIT](LICENSE)

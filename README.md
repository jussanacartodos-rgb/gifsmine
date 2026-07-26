# GifsMine 🎬

Rede social onde cada post é um GIF curto (cortado direto de um vídeo) com legenda, hashtag e uma trilha sonora pessoal escolhida por quem está vendo — não por quem postou.

## Estrutura do projeto

```
gifsmine/
├── index.html        → estrutura da página
├── css/
│   └── styles.css    → todo o visual (tema claro, gradiente arco-íris)
├── js/
│   └── app.js         → lógica do app (login, câmera, feed, Supabase)
├── render.yaml         → configuração de deploy no Render
├── .gitignore
└── README.md
```

## Funcionalidades

- **Login e cadastro** reais via Supabase Auth (email + senha, recuperação por email)
- **Criar GIF**: grava vídeo pela câmera (com permissão real de câmera/microfone) ou importa da galeria, corta o trecho e posta
- **Feed**: GIFs em moldura quadrada, com legenda, hashtag e localização opcional
- **Selos de qualidade**: bronze/prata/ouro, calculados automaticamente pelo número de curtidas
- **Rádio por humor**: trilha sonora pessoal (biblioteca própria grátis ou Spotify/Apple Music), tocada só para quem está ouvindo
- **Sugestão de trilha**: quem posta pode sugerir uma música pra quem for ver aquele GIF

## Stack

- HTML + CSS + JavaScript puro (sem framework, sem build step)
- [Supabase](https://supabase.com) — autenticação, banco de dados (Postgres) e armazenamento de vídeo

## Rodando localmente

```bash
npx serve .
```
Depois acesse `http://localhost:3000`. Servir localmente (em vez de abrir o arquivo direto) é importante porque câmera e localização exigem um "contexto seguro" (https ou localhost) pra funcionar.

## Deploy no GitHub + Render

### 1. Subir no GitHub
```bash
git init
git add .
git commit -m "primeira versão do GifsMine"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/gifsmine.git
git push -u origin main
```

### 2. Publicar no Render
1. Entre em [render.com](https://render.com) → **New** → **Static Site**
2. Conecte sua conta do GitHub e escolha o repositório `gifsmine`
3. O Render vai detectar o `render.yaml` automaticamente — não precisa configurar build command nem publish directory manualmente
4. Clique em **Create Static Site**

Em poucos minutos você recebe uma URL pública em HTTPS (tipo `gifsmine.onrender.com`) — com HTTPS de verdade, a permissão de câmera e localização funciona sem os avisos que apareciam ao abrir o arquivo local.

## Configuração do backend (Supabase)

- Tabelas: `profiles`, `posts`, `likes`
- Storage bucket: `gifs` (vídeos públicos para leitura)
- Row Level Security habilitado em todas as tabelas

Para usar seu próprio backend, troque `SUPABASE_URL` e `SUPABASE_ANON_KEY` no topo do `js/app.js`.

## Licença

Projeto pessoal em desenvolvimento.

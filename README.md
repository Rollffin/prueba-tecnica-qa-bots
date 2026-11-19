# Prueba Técnica QA Engineer: AI Agents, LLMs

Este repositorio contiene la resolución de la prueba técnica para QA Engineer, enfocada en la evaluación de agentes de IA y automatización de pruebas.

## Estructura del Proyecto

La estructura del proyecto sigue el plan de desarrollo, organizando cada ejercicio en su propia carpeta:

```
prueba-tecnica-qa-llm/
├── README.md
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── playwright.config.ts
│
├── ejercicio-1-llm-eval/
│   ├── src/
│   │   ├── scenarios.ts
│   │   ├── simulated-user.ts
│   │   ├── assistant.ts
│   │   ├── evaluator.ts
│   │   ├── detectors.ts
│   │   └── runner.ts
│   └── output/
│
├── ejercicio-2-api/
│   ├── tests/
│   │   ├── health.spec.ts
│   │   ├── auth.spec.ts
│   │   └── goals.spec.ts
│   └── helpers/
│       └── api-client.ts
│
├── ejercicio-3-chatbot/
│   └── tests/
│       └── botpress-chat.spec.ts
│
├── ejercicio-4-cicd/
│   └── (vive en .github/workflows/ci.yml en la raíz)
│
├── ejercicio-5-consolidado/
│   ├── src/
│   │   ├── aggregator.ts
│   │   └── report-template.ts
│   └── output/
│
└── output/
    ├── ejercicio-1/*.json
    ├── ejercicio-2/
    ├── ejercicio-3/
    └── consolidado/
```

## Configuración Inicial

1.  **Clonar el repositorio**:
    ```bash
    git clone <URL_DEL_REPOSITORIO>
    cd prueba-tecnica-qa-llm
    ```

2.  **Instalar dependencias**:
    ```bash
    npm install
    ```

3.  **Configurar variables de entorno**: Copiar `.env.example` a `.env` y rellenar las variables necesarias.

    ```bash
    cp .env.example .env
    ```

    Editar `.env`:
    ```
    GEMINI_API_KEY="TU_API_KEY_DE_GEMINI"
    BASE_URL_API="https://goal-tracker-api.onrender.com"
    ```

## Ejecución de Ejercicios

### Ejercicio 1: Evaluación Conversacional de Agentes LLM

Este ejercicio simula una conversación con un agente LLM y evalúa su rendimiento. Los resultados se guardarán en `output/ejercicio-1/`.

```bash
npm run eval:llm
```

### Ejercicio 2: Automatización de API (Goal Tracker API)

Suite de pruebas E2E para la Goal Tracker API. Los reportes se guardarán en `output/ejercicio-2/`.

```bash
npm run test:api
```

Los reportes (HTML + JSON) se guardan en `output/ejercicio-2/`.

### Ejercicio 3: Automatización de Chatbot Web (Botpress Docs)

Pruebas UI para el widget de chatbot en la documentación de Botpress. Los reportes y evidencias (screenshots/videos) se guardarán en `output/ejercicio-3/`.

```bash
npm run test:chatbot
```

Los reportes y evidencias (screenshots/videos) se guardan en `output/ejercicio-3/`.

### Ejercicio 4: CI/CD (GitHub Actions)

El pipeline de CI/CD está configurado en `.github/workflows/ci.yml`. Se ejecuta automáticamente en cada `push` o `pull_request` a la rama principal. Los resultados y artifacts estarán disponibles en las acciones de GitHub.

### Ejercicio 5: Reporte Consolidado

Este script consolida los resultados de los Ejercicios 1, 2 y 3 en un reporte global. El reporte se generará en `output/consolidado/`.

```bash
npm run report:consolidado
```

## Variables de Entorno

Consultar `.env.example` para las variables necesarias.
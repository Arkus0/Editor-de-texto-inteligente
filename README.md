# Juord - Editor de Texto Académico Inteligente

Editor de texto académico potenciado con IA, diseñado para escritura multidisciplinaria con herramientas de análisis, formalización y asistencia contextual.

## 🚀 Características Principales

### Editor Avanzado
- ✨ Editor de texto rico con formato completo (negrita, cursiva, listas, citas)
- 📊 **Tablas** con controles para añadir/eliminar filas y columnas
- 🔍 **Búsqueda y reemplazo** de texto
- 📈 **Contador de palabras** y estadísticas en tiempo real
- 👁️ **Modo enfoque** para escritura sin distracciones
- 📤 **Exportación** a HTML y Markdown

### Asistente IA Multidisciplinario
- 🤖 **Juappy**: Asistente conversacional que se adapta al campo académico
- ✍️ **Formalizar**: Reescritura en 3 estilos (Académica, Universitario, Escritor)
- 🎯 **Crítica constructiva**: Análisis desde perspectivas opuestas
- 🔗 **Conectores lógicos**: Sugerencias para mejorar cohesión
- 📝 **Evaluación**: Análisis automático con retroalimentación detallada
- 💡 **Ideas**: Ayuda contra el bloqueo del escritor
- 📚 **Sinónimos académicos**: Vocabulario contextual

### Gestión de Documentos
- 📁 Multi-documento con creación, edición y eliminación
- ☁️ Sincronización automática en la nube (Supabase)
- 💾 Guardado local con persistencia
- 🔄 Indicadores visuales de sincronización

### Herramientas Académicas
- 📖 Diccionario académico con 22+ términos de múltiples campos
- 📑 Gestor de bibliografía con integración DOI
- 🎓 Optimizado para filosofía, ciencias, literatura, ciencias sociales, economía, derecho

## 🛠️ Stack Tecnológico

- **Framework**: Next.js 16.1.1 (React 19)
- **Editor**: Tiptap 3.15.3 (ProseMirror)
- **IA**: OpenAI GPT-4/GPT-4o-mini + Vercel AI SDK
- **Backend**: Supabase (autenticación + base de datos)
- **Estado**: Zustand 5.0.10 con persistencia
- **UI**: Radix UI + Tailwind CSS 4
- **Lenguaje**: TypeScript 5

## 📦 Instalación Local

\`\`\`bash
# Clonar el repositorio
git clone https://github.com/Arkus0/Editor-de-texto-inteligente.git
cd Editor-de-texto-inteligente

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales

# Iniciar servidor de desarrollo
npm run dev
\`\`\`

Abre [http://localhost:3000](http://localhost:3000) para ver la aplicación.

## 🔐 Variables de Entorno Requeridas

Crea un archivo \`.env.local\` con:

\`\`\`env
# OpenAI API (requerido para funciones IA)
OPENAI_API_KEY=sk-your-openai-api-key-here

# Supabase (requerido para sincronización en la nube)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key-here
\`\`\`

### Cómo obtener las credenciales:

**OpenAI API Key:**
1. Ve a [platform.openai.com](https://platform.openai.com/)
2. Crea una cuenta o inicia sesión
3. Ve a API Keys y crea una nueva key

**Supabase:**
1. Ve a [supabase.com](https://supabase.com/)
2. Crea un nuevo proyecto
3. Ve a Settings > API
4. Copia la URL del proyecto y la clave anon/public

### Configuración de Supabase

Ejecuta estos SQL en tu proyecto de Supabase:

\`\`\`sql
-- Tabla de documentos
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  last_modified BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de referencias bibliográficas
CREATE TABLE references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('book', 'article', 'web')),
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  year TEXT NOT NULL,
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Políticas de seguridad (Row Level Security)
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE references ENABLE ROW LEVEL SECURITY;

-- Los usuarios solo pueden ver/editar sus propios documentos
CREATE POLICY "Users can CRUD their own documents"
  ON documents FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD their own references"
  ON references FOR ALL
  USING (auth.uid() = user_id);
\`\`\`

## 🚀 Deploy en Vercel (Recomendado)

### Opción 1: Deploy con el botón de Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Arkus0/Editor-de-texto-inteligente)

### Opción 2: Deploy manual

1. **Crea una cuenta en [Vercel](https://vercel.com/)**

2. **Conecta tu repositorio de GitHub**
   - Ve a [vercel.com/new](https://vercel.com/new)
   - Selecciona "Import Git Repository"
   - Autoriza Vercel a acceder a tu GitHub
   - Selecciona el repositorio \`Editor-de-texto-inteligente\`

3. **Configura las variables de entorno**
   - En la sección "Environment Variables", añade:
     - \`OPENAI_API_KEY\`
     - \`NEXT_PUBLIC_SUPABASE_URL\`
     - \`NEXT_PUBLIC_SUPABASE_ANON_KEY\`

4. **Deploy**
   - Click en "Deploy"
   - Espera 2-3 minutos
   - ¡Tu app estará disponible en \`https://tu-proyecto.vercel.app\`!

### Opción 3: Deploy desde CLI

\`\`\`bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Para producción
vercel --prod
\`\`\`

Durante el deployment, Vercel te pedirá configurar las variables de entorno.

## 📝 Comandos Disponibles

\`\`\`bash
npm run dev      # Inicia servidor de desarrollo
npm run build    # Construye para producción
npm run start    # Inicia servidor de producción
npm run lint     # Ejecuta linter (ESLint)
\`\`\`

## 🗂️ Estructura del Proyecto

\`\`\`
├── src/
│   ├── app/
│   │   ├── page.tsx              # Página principal
│   │   └── api/                  # APIs de IA
│   │       ├── chat/             # Juappy (asistente)
│   │       ├── formalizar/       # Reescritura de texto
│   │       ├── critica/          # Crítica constructiva
│   │       ├── evaluar/          # Evaluación académica
│   │       └── ...
│   ├── components/
│   │   ├── editor/
│   │   │   ├── EditorTexto.tsx   # Editor principal
│   │   │   └── EditorToolbar.tsx # Barra de herramientas
│   │   ├── Juappy.tsx            # Asistente IA
│   │   └── bibliography/         # Gestor de bibliografía
│   ├── store/                    # Zustand stores
│   │   ├── useDocumentStore.ts   # Gestión de documentos
│   │   └── useBibliographyStore.ts
│   └── lib/
│       ├── dictionary.ts         # Diccionario académico
│       └── supabaseClient.ts     # Cliente Supabase
├── package.json
└── next.config.ts
\`\`\`

## 🎯 Uso

1. **Escribe tu texto** en el editor principal
2. **Selecciona texto** para acceder a herramientas IA
3. **Haz clic en Juappy** (icono de clip abajo-derecha) para asistencia contextual
4. **Usa el contador** de palabras para estadísticas
5. **Activa el modo enfoque** para eliminar distracciones
6. **Exporta** tu trabajo a HTML o Markdown

## 🔧 Configuración Adicional

### Rate Limiting

Las APIs tienen rate limiting por IP:
- Formalizar: 10 req/min
- Conectores: 15 req/min
- Sinónimos: 20 req/min
- Evaluar: 5 req/10min

### Personalización

- **Diccionario**: Edita \`src/lib/dictionary.ts\` para añadir términos
- **Prompts IA**: Modifica \`src/app/api/*/route.ts\` para cambiar comportamiento
- **Estilos**: Personaliza \`src/app/globals.css\` y Tailwind config

## 📄 Licencia

Este proyecto está bajo licencia MIT.

## 🤝 Contribuciones

¡Las contribuciones son bienvenidas! Por favor:
1. Fork el proyecto
2. Crea una rama para tu feature (\`git checkout -b feature/AmazingFeature\`)
3. Commit tus cambios (\`git commit -m 'Add some AmazingFeature'\`)
4. Push a la rama (\`git push origin feature/AmazingFeature\`)
5. Abre un Pull Request

## 📧 Soporte

Si encuentras algún problema o tienes sugerencias, por favor abre un [issue en GitHub](https://github.com/Arkus0/Editor-de-texto-inteligente/issues).

---

**Desarrollado con ❤️ para la comunidad académica**

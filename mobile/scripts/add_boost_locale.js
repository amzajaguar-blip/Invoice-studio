const fs = require('fs');
const path = require('path');

const locales = {
  it: { ad_unavailable: "Video non disponibile al momento. Riprova più tardi." },
  en: { ad_unavailable: "Video not available right now. Try again later." },
  es: { ad_unavailable: "Video no disponible ahora. Inténtalo más tarde." },
  fr: { ad_unavailable: "Vidéo non disponible. Réessayez plus tard." },
  de: { ad_unavailable: "Video momentan nicht verfügbar. Später erneut versuchen." },
  pt: { ad_unavailable: "Vídeo não disponível agora. Tente mais tarde." },
  zh: { ad_unavailable: "视频暂不可用，请稍后重试。" }
};

for (const [lang, translations] of Object.entries(locales)) {
  const filePath = path.join(__dirname, '..', 'lib', 'locales', `${lang}.ts`);
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (!content.includes('"boost":')) {
    // Insert before the last closing brace
    const insertPoint = content.lastIndexOf('}');
    if (insertPoint !== -1) {
      const before = content.slice(0, insertPoint);
      const after = content.slice(insertPoint);
      const boostString = `,\n  "boost": {\n    "ad_unavailable": "${translations.ad_unavailable}"\n  }\n`;
      content = before + boostString + after;
      fs.writeFileSync(filePath, content);
      console.log(`Updated ${lang}.ts`);
    }
  }
}

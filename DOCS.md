# Sassonia — תיעוד מלא / Full Documentation

> **Family Hub** — מתכונים, רשימת קניות ומשימות  
> Home Assistant Add-on | Version 1.2.2 | Port: 8099

---

## תוכן עניינים / Table of Contents

1. [מה זה ששונייה?](#מה-זה-ששונייה)
2. [ארכיטקטורה](#ארכיטקטורה)
3. [מבנה קבצים](#מבנה-קבצים)
4. [התקנה](#התקנה)
5. [הגדרות](#הגדרות)
6. [גישה לאפליקציה](#גישה-לאפליקציה)
7. [עריכה ושינוי הקוד](#עריכה-ושינוי-הקוד)
8. [העלאת קוד לגיטהאב](#העלאת-קוד-לגיטהאב)
9. [עדכון בהום אסיסטנט](#עדכון-בהום-אסיסטנט)

---

## מה זה ששונייה?

**Sassonia** הוא תוסף (Add-on) להום אסיסטנט שמרכז ניהול משפחתי יומיומי במקום אחד:

| פיצ'ר | תיאור |
|-------|-------|
| 📖 **ספר מתכונים** | שמירה, עריכה וחיפוש מתכונים. סריקת תמונת מתכון עם AI (Google Gemini) |
| 🛒 **רשימות קניות** | רשימות מרובות (סופר, בסיס, חגים וכו'). ייבוא מצרכים מתוך מתכון בלחיצה |
| ✅ **משימות** | רשימת to-do עם עדיפויות |
| 📱 **PWA** | ניתן להתקין על מסך הבית של הטלפון כאפליקציה |
| 🌐 **דו-לשוני** | ממשק בעברית ובאנגלית |

---

## ארכיטקטורה

```
┌─────────────────────────────────────────────────────┐
│                   Sassonia Add-on                   │
│                                                     │
│  ┌──────────────────┐    ┌──────────────────────┐  │
│  │  Frontend        │    │  Backend             │  │
│  │  React + Vite    │───▶│  Python FastAPI      │  │
│  │  Tailwind CSS    │    │  Uvicorn (ASGI)      │  │
│  │  PWA enabled     │    │  SQLite database     │  │
│  └──────────────────┘    └──────────────────────┘  │
│                                    │                │
│                          ┌─────────▼──────────┐    │
│                          │  Google Gemini AI   │    │
│                          │  (recipe scanning)  │    │
│                          └────────────────────┘    │
│                                                     │
│  Port: 8099          Data: /data/ (persistent)      │
└─────────────────────────────────────────────────────┘
```

**תהליך ה-Build (Docker multi-stage):**
1. **שלב 1** — Node.js 20 מקמפל את ה-React frontend → `dist/`
2. **שלב 2** — Python 3.11 מריץ את ה-backend + מגיש את ה-frontend המקומפל

---

## מבנה קבצים

```
Sassonia/                          ← GitHub repository root
├── repository.json                ← מגדיר את זה כ-HACS repository
├── README.md                      ← תיעוד ראשי
├── .gitignore
└── sassonia/                      ← תיקיית התוסף
    ├── config.yaml                ← הגדרות התוסף (שם, גרסה, פורט, schema)
    ├── build.yaml                 ← base images לכל ארכיטקטורה
    ├── Dockerfile                 ← הוראות בניית הדוקר
    ├── run.sh                     ← סקריפט הפעלה (קורא Gemini key, מריץ uvicorn)
    ├── backend/                   ← קוד Python
    │   ├── main.py                ← FastAPI app, middleware, routes
    │   ├── database.py            ← SQLite + SQLAlchemy setup
    │   ├── models.py              ← מודלי בסיס נתונים
    │   ├── requirements.txt       ← תלויות Python
    │   └── routers/
    │       ├── recipes.py         ← API endpoints למתכונים
    │       ├── shopping.py        ← API endpoints לרשימות קניות
    │       ├── tasks.py           ← API endpoints למשימות
    │       └── gemini.py          ← API endpoint לסריקת מתכון עם AI
    └── frontend/                  ← קוד React
        ├── package.json           ← תלויות Node.js
        ├── vite.config.js         ← הגדרות Vite bundler
        ├── tailwind.config.js     ← הגדרות Tailwind CSS
        ├── index.html             ← HTML template ראשי
        ├── public/                ← קבצים סטטיים (icons, manifest)
        ├── scripts/
        │   └── generate-icons.cjs ← סקריפט יצירת PWA icons
        └── src/
            ├── main.jsx           ← נקודת כניסה React
            ├── App.jsx            ← ניתוב (React Router)
            ├── api.js             ← כל קריאות ה-API לbackend
            ├── index.css          ← סגנונות גלובליים
            └── pages/
                ├── RecipesPage.jsx       ← עמוד מתכונים
                ├── RecipeDetailPage.jsx  ← פרטי מתכון
                ├── RecipeFormPage.jsx    ← הוספה/עריכת מתכון
                ├── ShoppingPage.jsx      ← רשימות קניות
                └── TasksPage.jsx         ← משימות
```

---

## התקנה

### דרישות מוקדמות
- Home Assistant עם Supervisor (HAOS או Supervised)
- מפתח API של Google Gemini (בחינם — [https://aistudio.google.com](https://aistudio.google.com))

### שלבי התקנה

**1. הוסף את ה-repository בהום אסיסטנט:**

```
Settings → Add-ons → Add-on Store → ⋮ (שלוש נקודות) → Repositories
```

הוסף את הכתובת:
```
https://github.com/sasson123/Sassonia
```

**2. מצא והתקן את Sassonia:**

- לאחר שה-repository נוסף, חפש **Sassonia** בחנות
- לחץ **Install** (התקנה אורכת 2-5 דקות כי בונה Docker image)

**3. הגדר את מפתח ה-API:**

בלשונית **Configuration** של התוסף:
```yaml
gemini_api_key: "YOUR_API_KEY_HERE"
```

**4. הפעל את התוסף:**

לחץ **Start** בלשונית **Info**.

---

## הגדרות

קובץ ההגדרות: `sassonia/config.yaml`

```yaml
name: Sassonia
version: "1.2.2"
slug: sassonia
description: Family Hub — Recipes, Shopping List & Tasks
arch:
  - aarch64
  - amd64
ports:
  8099/tcp: 8099
options:
  gemini_api_key: ""
schema:
  gemini_api_key: str
```

| שדה | תיאור |
|-----|-------|
| `version` | גרסת התוסף — **חייבים להעלות** בכל עדכון |
| `gemini_api_key` | מפתח API של Google Gemini — נדרש לסריקת מתכונים |

---

## גישה לאפליקציה

```
http://[IP-של-הום-אסיסטנט]:8099
```

לדוגמה:
```
http://homeassistant.local:8099
http://10.0.0.9:8099
```

### התקנה כ-PWA על הטלפון

**Android (Chrome):**
1. פתח את הכתובת בדפדפן
2. לחץ על תפריט ⋮ → "הוסף למסך הבית"

**iOS (Safari):**
1. פתח את הכתובת ב-Safari
2. לחץ על סמל השיתוף → "הוסף למסך הבית"

---

## עריכה ושינוי הקוד

### איפה לערוך?

| מה רוצים לשנות | איפה לערוך |
|----------------|------------|
| עיצוב / UI | `sassonia/frontend/src/pages/*.jsx` |
| לוגיקת ממשק | `sassonia/frontend/src/App.jsx` |
| קריאות API | `sassonia/frontend/src/api.js` |
| סגנונות CSS | `sassonia/frontend/src/index.css` |
| API endpoints | `sassonia/backend/routers/*.py` |
| מבנה בסיס הנתונים | `sassonia/backend/models.py` |
| הגדרות AI/Gemini | `sassonia/backend/routers/gemini.py` |
| גרסה ושם התוסף | `sassonia/config.yaml` |

### עריכה מהטרמינל בהום אסיסטנט

**1. שכפל את ה-repo (פעם ראשונה בלבד):**
```bash
cd /root
git clone https://github.com/sasson123/Sassonia.git
cd Sassonia
```

**2. ערוך קבצים:**
```bash
# לדוגמה — עריכת עמוד הקניות
nano sassonia/frontend/src/pages/ShoppingPage.jsx

# או עם VSCode (אם Studio Code Server מותקן) — פתח את הקובץ מה-UI
```

**3. לאחר עריכה — עדכן גרסה ב-config.yaml:**
```bash
nano sassonia/config.yaml
# שנה: version: "1.2.3"  (מספר גבוה מהגרסה הנוכחית)
```

---

## העלאת קוד לגיטהאב

### הגדרת פרטי גיט (פעם ראשונה בלבד)

```bash
git config --global user.name "sasson123"
git config --global user.email "sasson123@gmail.com"
```

### אימות מול GitHub — Personal Access Token (PAT)

> **הסבר:** GitHub לא מאפשר שימוש בסיסמה. צריך Personal Access Token.

**יצירת Token (פעם ראשונה / כל 90 יום):**
1. פתח: [https://github.com/settings/tokens](https://github.com/settings/tokens)
2. לחץ **Generate new token (classic)**
3. תן שם (לדוגמה: `sassonia-ha`)
4. סמן הרשאה: `repo` (כל תת-האפשרויות)
5. לחץ **Generate token**
6. **העתק את ה-token — יוצג פעם אחת בלבד!**

**שמור את ה-token כדי לא להזין בכל פעם:**
```bash
git config --global credential.helper store
```
בפעם הראשונה שתדחוף, הזן:
- Username: `sasson123`
- Password: `[ה-token שיצרת]`

ה-token ישמר אוטומטית לפעמים הבאות.

---

### תהליך העלאה — כל הפקודות

#### 1. בדוק מה השתנה
```bash
cd /root/Sassonia
git status
```
פלט לדוגמה:
```
modified:   sassonia/frontend/src/pages/ShoppingPage.jsx
modified:   sassonia/config.yaml
```

#### 2. ראה את השינויים בפירוט (אופציונלי)
```bash
git diff
```

#### 3. הוסף את הקבצים שרוצים להעלות
```bash
# הוסף קובץ ספציפי:
git add sassonia/frontend/src/pages/ShoppingPage.jsx
git add sassonia/config.yaml

# או הוסף הכל:
git add .
```

#### 4. צור commit עם הסבר
```bash
git commit -m "v1.2.3: תיאור מה שינית"
```
לדוגמה:
```bash
git commit -m "v1.2.3: Add filter by category to shopping list"
```

#### 5. העלה לגיטהאב
```bash
git push origin main
```

---

### דוגמה מלאה — מ-clone עד push

```bash
# שכפל את ה-repo (פעם ראשונה בלבד)
cd /root
git clone https://github.com/sasson123/Sassonia.git
cd Sassonia

# הגדרת פרטים (פעם ראשונה בלבד)
git config --global user.name "sasson123"
git config --global user.email "sasson123@gmail.com"
git config --global credential.helper store

# --- ערוך קבצים כרצונך ---

# עדכן גרסה ב-config.yaml
# version: "1.2.3"

# בדוק מה השתנה
git status

# הוסף לכל השינויים
git add .

# commit
git commit -m "v1.2.3: תיאור השינוי"

# push
git push origin main
# (בפעם הראשונה יבקש username + token)
```

---

### עבודה על repo קיים (לא clone חדש)

אם כבר קיים `/root/Sassonia` מ-session קודם:

```bash
cd /root/Sassonia

# עדכן מהגיטהאב לפני שמתחיל לערוך (חשוב!)
git pull origin main

# --- ערוך קבצים ---

# הוסף ודחוף
git add .
git commit -m "v1.2.x: תיאור"
git push origin main
```

---

## עדכון בהום אסיסטנט

לאחר שדחפת לגיטהאב **עם גרסה חדשה** ב-`config.yaml`:

### שיטה 1 — עדכון אוטומטי דרך הממשק

1. לך ל: **Settings → Add-ons → Sassonia**
2. אם יש עדכון — תופיע כפתור **Update**
3. לחץ **Update** (יבנה מחדש את Docker image — 2-5 דקות)

> לפעמים HA לא מגלה את הגרסה החדשה מיד. המתן כמה דקות או לחץ Refresh.

### שיטה 2 — אם לא מזוהה עדכון אוטומטי

```
Settings → Add-ons → Add-on Store → ⋮ → Reload stores
```
לאחר מכן חזור ל-Sassonia ובדוק אם יש עדכון.

### שיטה 3 — מהטרמינל (מהיר)

```bash
ha addons rebuild 44dc2412_sassonia
```
זה יבנה מחדש את ה-image עם הקוד האחרון מ-GitHub.

---

## טיפים חשובים

### 1. חובה לעדכן גרסה בכל שינוי
בקובץ `sassonia/config.yaml`:
```yaml
version: "1.2.3"  # העלה ב-0.0.1 בכל פעם
```
HA לא יזהה עדכון בלי שינוי גרסה.

### 2. מחרוזות סמנטיות (Semantic Versioning)
```
major.minor.patch
1.2.3
  │ │ └── שינויים קטנים / bug fixes
  │ └──── פיצ'רים חדשים
  └────── שינויים שוברים תאימות לאחור
```

### 3. בסיס הנתונים
- נשמר ב: `/data/sassonia.db` (בתוך ה-add-on)
- **לא נמחק** בעת עדכון גרסה
- נמחק רק אם מסירים ומתקינים מחדש

### 4. גיבוי הנתונים
הנתונים נכללים אוטומטיקה בגיבויי HA הרגילים. אין צורך בגיבוי נפרד.

---

## לינקים שימושיים

| משאב | כתובת |
|------|-------|
| GitHub Repository | https://github.com/sasson123/Sassonia |
| Google AI Studio (Gemini key) | https://aistudio.google.com |
| GitHub Tokens | https://github.com/settings/tokens |
| HA Add-on Development Docs | https://developers.home-assistant.io/docs/add-ons |

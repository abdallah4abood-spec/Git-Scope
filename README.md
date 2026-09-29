<div align="center">

# 🚀 GitScope | Advanced GitHub Profile Explorer

  <p><strong>أداة ويب احترافية وعصرية لاستكشاف وتحليل ملفات مستخدمي GitHub بتصميم مذهل وميزات تفاعلية متقدمة.</strong></p>

  <p>
    <a href="https://perfect-bun.surge.sh/" target="_blank">🌐 Live Demo</a> •
    <a href="#-features">✨ Features</a> •
    <a href="#-tech-stack">🛠️ Tech Stack</a> •
    <a href="#-installation--setup">⚙️ Setup</a>
  </p>

  <!-- Badges -->
  <p>
    <img src="https://img.shields.io/badge/status-active-success.svg" alt="Status">
    <img src="https://img.shields.io/badge/tailwindcss-v3.x-blue?logo=tailwind-css" alt="Tailwind CSS">
    <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License">
  </p>

</div>

---

## 🎯 Overview

تأسست أداة **GitScope** كحل عصري واحترافي مستوحى من تحديات Frontend Mentor وتم تطويرها لتتجاوز الحدود التقليدية عبر دمج واجهة مستخدم متطورة (UI/UX) بنمط *Cyber Neon / Obsidian Violet* مع دعم كامل للوضع الداكن والفاتح (Dark/Light Mode). تتيح الأداة للمطورين والباحثين استعراض إحصائيات حسابات GitHub بدقة، ومتابعة المستودعات، وتصدير بطاقات الهوية الرقمية للملفات الشخصية مباشرة.

---

## ✨ Features

- **🔍 بحث ذكي وفوري:** استعلام دقيق عن أي حساب مستخدم على GitHub عبر الـ REST API.
- **🎨 واجهة تفاعلية بتصميم Cyber Neon:** تصميم جذاب مع دعم سلس ومخصص للوضع الداكن (Dark Mode) والفاتح (Light Mode).
- **💾 نظام التخزين المؤقت (Caching):** حفظ مؤقت لنتائج البحث في `localStorage` لتفادي الوصول للحد الأقصى لطلبات GitHub (Rate Limits) وتسريع الاستجابة.
- **📤 تصدير البطاقة (Export Card):** إمكانية تحميل بطاقة الملف الشخصي مباشرة كصورة عالية الدقة **PNG** أو مستند **PDF** جاهز للمشاركة.
- **📱 تصميم متجاوب (Responsive):** مواءمة كاملة لكافة الشاشات (الهواتف الذكية، الأجهزة اللوحية، وشاشات سطح المكتب).
- **⚡ تأثيرات بصرية (Micro-interactions):** تأثيرات تفاعلية أنيقة وتنبيهات فورية (Toasts) وحالات تحميل افتراضية (Skeleton Loaders).

---

## 🛠️ Tech Stack

تم بناء وتطوير المشروع باستخدام أحدث تقنيات الويب الحديثة دون تعقيدات أطر العمل الثقيلة:

- **HTML5 & Semantic Markup:** لهيكلة سليمة ومتوافقة مع محركات البحث ومعايير إمكانية الوصول.
- **Tailwind CSS:** لتنسيق الأنماط الديناميكية وتطبيق ثيمات الألوان والتصميم المتجاوب بكفاءة عالية.
- **Vanilla JavaScript (ES6+):** لإدارة حالة التطبيق، التفاعل مع الأحداث، وت,جيه طلبات الـ API ومعالجة DOM.
- **External Libraries:**
  - `html2canvas`: لالتقاط وتصدير بطاقات المستخدمين كصور بدقة عالية.
  - `jsPDF`: لتوليد وتصدير ملفات الـ PDF بشكل منسق.

---

## 📸 Screenshots & Preview

<div align="center">
  <p><em>لقطات شاشة توضح واجهة الأداة في مختلف الحالات والوضع الداكن:</em></p>
  <!-- يمكنك إضافة روابط الصور الخاصة بك هنا -->
  <img src="https://github.com/user-attachments/assets/433ae913-bb33-4d8b-ac62-28405a8be058" width="48%" alt="Desktop Light Mode">
  <img src="https://github.com/user-attachments/assets/6ec0b9aa-714a-4973-a1c5-e8cf2bc680e4" width="48%" alt="Desktop Dark Mode">
</div>

---

## ⚙️ Installation & Setup

إذا أردت تشغيل المشروع محلياً على جهازك، اتبع الخطوات البسيطة التالية:

1. **استنساخ المستودع (Clone Repository):**
   ```bash
   git clone [https://github.com/sayaliakbar/gitscope.git](https://github.com/sayaliakbar/gitscope.git)
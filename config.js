// ============================================================
// 改这里就够了：店名 + 客服 WhatsApp 号码（全站共用）
// STORE NAME + WhatsApp number — change in this one file only.
// WhatsApp 号码写纯数字国际格式：美国 +1 (930) 224-0183 -> 19302240183
// ============================================================
module.exports = {
  storeName: 'MM Luxe Shop',
  whatsappNumber: '19302240183',          // 纯数字，用于 wa.me 跳转
  whatsappDisplay: '+1 (930) 224-0183',   // 显示给顾客看的号码
  defaultLang: 'en',                       // 默认英文，顾客可自己切中文
  exchangeRate: 7.2                        // 成本换算用：1 美元 = 7.2 人民币（后台成本 ¥ 换算 $ 用，改这里就行）
};

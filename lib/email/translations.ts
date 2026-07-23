// Receipt email strings. Deliberately NOT next-intl: these render outside the
// Next request lifecycle (webhooks), and messages/*.json are UI bundles.
export type ReceiptLocale = 'en' | 'ru' | 'am';

export interface ReceiptStrings {
  orderSubject: string;
  creditsSubject: string;
  preview: string;
  thanks: string;
  item: string;
  qty: string;
  subtotal: string;
  shipping: string;
  total: string;
  creditsAdded: string;
  viewOrder: string;
  viewCredits: string;
  footerNote: string;
}

export const RECEIPT_STRINGS: Record<ReceiptLocale, ReceiptStrings> = {
  en: {
    orderSubject: 'Your Uniqraft order receipt',
    creditsSubject: 'Your Uniqraft credits receipt',
    preview: 'Thanks for your purchase — your receipt is inside.',
    thanks: 'Thanks for your purchase!',
    item: 'Item',
    qty: 'Qty',
    subtotal: 'Subtotal',
    shipping: 'Shipping',
    total: 'Total',
    creditsAdded: 'Credits added',
    viewOrder: 'View your order',
    viewCredits: 'View your credits',
    footerNote: 'You are receiving this email because you made a purchase on Uniqraft.',
  },
  ru: {
    orderSubject: 'Ваш чек заказа Uniqraft',
    creditsSubject: 'Ваш чек за кредиты Uniqraft',
    preview: 'Спасибо за покупку — ваш чек внутри.',
    thanks: 'Спасибо за покупку!',
    item: 'Товар',
    qty: 'Кол-во',
    subtotal: 'Подытог',
    shipping: 'Доставка',
    total: 'Итого',
    creditsAdded: 'Начислено кредитов',
    viewOrder: 'Посмотреть заказ',
    viewCredits: 'Посмотреть кредиты',
    footerNote: 'Вы получили это письмо, потому что совершили покупку на Uniqraft.',
  },
  am: {
    orderSubject: 'Ձեր Uniqraft պատվերի անդորրագիրը',
    creditsSubject: 'Ձեր Uniqraft կրեդիտների անդորրագիրը',
    preview: 'Շնորհակալություն գնումի համար — անդորրագիրը ներսում է։',
    thanks: 'Շնորհակալություն գնումի համար։',
    item: 'Ապրանք',
    qty: 'Քանակ',
    subtotal: 'Ենթագումար',
    shipping: 'Առաքում',
    total: 'Ընդամենը',
    creditsAdded: 'Ավելացված կրեդիտներ',
    viewOrder: 'Դիտել պատվերը',
    viewCredits: 'Դիտել կրեդիտները',
    footerNote: 'Դուք ստացել եք այս նամակը, քանի որ գնում եք կատարել Uniqraft-ում։',
  },
};

export type FlavorChoice = {
  value: string
  label: string
  labelMm: string
  emoji: string
  extraPrice: number  // 0 = free, >0 = adds to price
}

export type FlavorOption = {
  id: string
  label: string
  labelMm: string
  type: 'single' | 'multi'  // single = radio, multi = checkbox (can pick many)
  required?: boolean
  choices: FlavorChoice[]
}

export type MenuItem = {
  id: number
  name: string
  nameMm: string
  description: string
  descMm: string
  price: number
  categoryId: number
  isRecommended?: boolean
  spiceLevel?: 1 | 2 | 3
  options?: FlavorOption[]
}

export type Category = {
  id: number
  name: string
  nameMm: string
  emoji: string
  items: MenuItem[]
}

// ─── REUSABLE OPTION SETS ──────────────────────────────────────

const SPICE_OPTION: FlavorOption = {
  id: 'spice', label: 'Spice Level', labelMm: 'အစပ်အဆင့်', type: 'single', required: true,
  choices: [
    { value: 'mild', label: 'Mild', labelMm: 'အနည်းငယ်', emoji: '🌶️', extraPrice: 0 },
    { value: 'medium', label: 'Medium', labelMm: 'အလယ်အလတ်', emoji: '🌶️🌶️', extraPrice: 0 },
    { value: 'hot', label: 'Hot', labelMm: 'အစပ်', emoji: '🌶️🌶️🌶️', extraPrice: 0 },
    { value: 'extra_hot', label: 'Extra Hot', labelMm: 'အရမ်းစပ်', emoji: '🔥', extraPrice: 0 },
  ]
}

const SWEETNESS_OPTION: FlavorOption = {
  id: 'sweet', label: 'Sweetness', labelMm: 'အချိုအဆင့်', type: 'single', required: true,
  choices: [
    { value: 'less', label: 'Less Sweet', labelMm: 'အချိုလျှော့', emoji: '🍬', extraPrice: 0 },
    { value: 'normal', label: 'Normal', labelMm: 'ပုံမှန်', emoji: '😊', extraPrice: 0 },
    { value: 'extra', label: 'Extra Sweet', labelMm: 'အချိုပိုထည့်', emoji: '🍯', extraPrice: 0 },
  ]
}

const SIZE_OPTION: FlavorOption = {
  id: 'size', label: 'Size', labelMm: 'အရွယ်အစား', type: 'single', required: true,
  choices: [
    { value: 'regular', label: 'Regular', labelMm: 'ပုံမှန်', emoji: '🥄', extraPrice: 0 },
    { value: 'large', label: 'Large', labelMm: 'ကြီး', emoji: '🥣', extraPrice: 500 },
  ]
}

const RICE_EXTRAS: FlavorOption = {
  id: 'rice_extras', label: 'Add Extra', labelMm: 'ထပ်ထည့်ရန်', type: 'multi',
  choices: [
    { value: 'egg', label: 'Fried Egg', labelMm: 'ကြက်ဥကြော်', emoji: '🍳', extraPrice: 300 },
    { value: 'cheese', label: 'Cheese', labelMm: 'ဒိန်ခဲ', emoji: '🧀', extraPrice: 500 },
    { value: 'extra_meat', label: 'Extra Meat', labelMm: 'အသားပိုထည့်', emoji: '🥩', extraPrice: 800 },
    { value: 'chili_oil', label: 'Chili Oil', labelMm: 'ငရုတ်ဆီ', emoji: '🌶️', extraPrice: 0 },
  ]
}

const NOODLE_EXTRAS: FlavorOption = {
  id: 'noodle_extras', label: 'Add Extra', labelMm: 'ထပ်ထည့်ရန်', type: 'multi',
  choices: [
    { value: 'egg', label: 'Boiled Egg', labelMm: 'ကြက်ဥပြုတ်', emoji: '🥚', extraPrice: 300 },
    { value: 'fritters', label: 'Extra Fritters', labelMm: 'အကြော်ပိုထည့်', emoji: '🥠', extraPrice: 200 },
    { value: 'lime', label: 'Extra Lime', labelMm: 'သံပုရာ', emoji: '🍋', extraPrice: 0 },
    { value: 'chili', label: 'Chili Flakes', labelMm: 'ငရုတ်သီးမှုန့်', emoji: '🌶️', extraPrice: 0 },
  ]
}

const GRILLED_EXTRAS: FlavorOption = {
  id: 'grill_extras', label: 'Add Extra', labelMm: 'ထပ်ထည့်ရန်', type: 'multi',
  choices: [
    { value: 'extra_sauce', label: 'Extra Dipping Sauce', labelMm: 'အချိုရည်ပိုထည့်', emoji: '🥫', extraPrice: 200 },
    { value: 'cheese', label: 'Melted Cheese', labelMm: 'ဒိန်ခဲ', emoji: '🧀', extraPrice: 500 },
    { value: 'fries', label: 'Side Fries', labelMm: 'အာလူးကြော်', emoji: '🍟', extraPrice: 600 },
    { value: 'coleslaw', label: 'Extra Coleslaw', labelMm: 'သုပ်', emoji: '🥗', extraPrice: 300 },
  ]
}

const DRINK_EXTRAS: FlavorOption = {
  id: 'drink_extras', label: 'Add Extra', labelMm: 'ထပ်ထည့်ရန်', type: 'multi',
  choices: [
    { value: 'boba', label: 'Boba Pearls', labelMm: 'ပုလဲလုံးများ', emoji: '🧋', extraPrice: 300 },
    { value: 'jelly', label: 'Coconut Jelly', labelMm: 'အုန်းသီးဂျယ်လီ', emoji: '🍮', extraPrice: 200 },
    { value: 'whip', label: 'Whipped Cream', labelMm: 'နို့နှစ်ထူ', emoji: '🍦', extraPrice: 300 },
  ]
}

const ICE_OPTION: FlavorOption = {
  id: 'ice', label: 'Ice Level', labelMm: 'ရေခဲအဆင့်', type: 'single', required: true,
  choices: [
    { value: 'no_ice', label: 'No Ice', labelMm: 'ရေခဲမထည့်', emoji: '🚫', extraPrice: 0 },
    { value: 'less', label: 'Less Ice', labelMm: 'ရေခဲနည်းနည်း', emoji: '🧊', extraPrice: 0 },
    { value: 'normal', label: 'Normal Ice', labelMm: 'ပုံမှန်', emoji: '🧊🧊', extraPrice: 0 },
  ]
}

// ─── MENU DATA ──────────────────────────────────────────────────

export const categories: Category[] = [
  {
    id: 1, name: 'Rice', nameMm: 'ထမင်းများ', emoji: '🍚',
    items: [
      { id: 1, name: 'Fried Rice', nameMm: 'ထမင်းကြော်', description: 'Wok-fried jasmine rice with egg, vegetables & soy sauce. Served hot from the wok with a side of fresh cucumber slices.', descMm: 'ကြက်ဥ၊ ဟင်းသီးဟင်းရွက်နှင့် ပဲငံပြာရည်ဖြင့် ကြော်ထားသော ထမင်း', price: 2500, categoryId: 1, isRecommended: true, spiceLevel: 1, options: [SPICE_OPTION, SIZE_OPTION, RICE_EXTRAS] },
      { id: 2, name: 'Chicken Biryani', nameMm: 'ကြက်သား ဗိရိယာနီ', description: 'Aromatic basmati rice layered with tender spiced chicken, caramelized onions & raita on the side.', descMm: 'မွှေးကြိုင်သော ဆန်နှင့် ကြက်သား', price: 4500, categoryId: 1, isRecommended: true, spiceLevel: 2, options: [SPICE_OPTION, SIZE_OPTION, RICE_EXTRAS] },
      { id: 3, name: 'Egg Fried Rice', nameMm: 'ကြက်ဥ ထမင်းကြော်', description: 'Simple classic egg fried rice tossed with spring onions and a hint of sesame oil.', descMm: 'ကြက်ဥနှင့် ကြော်ထားသော ထမင်း', price: 1800, categoryId: 1, spiceLevel: 1, options: [SPICE_OPTION, RICE_EXTRAS] },
    ]
  },
  {
    id: 2, name: 'Noodles', nameMm: 'ခေါက်ဆွဲများ', emoji: '🍜',
    items: [
      { id: 4, name: 'Mohinga', nameMm: 'မုန့်ဟင်းခါး', description: 'Myanmar\'s beloved national dish — rich catfish soup with rice noodles, banana stem, lemongrass & crispy fritters.', descMm: 'မြန်မာ့ အမျိုးသား စာ — ငါးရံ့ဟင်းရည်နှင့် မုန့်ဖတ်', price: 2000, categoryId: 2, isRecommended: true, spiceLevel: 2, options: [SPICE_OPTION, SIZE_OPTION, NOODLE_EXTRAS] },
      { id: 5, name: 'Shan Noodles', nameMm: 'ရှမ်းခေါက်ဆွဲ', description: 'Shan-style flat rice noodles in a savory tomato & chicken sauce topped with roasted peanuts.', descMm: 'ခရမ်းချဉ်နှင့် ကြက်သားဖြင့် ရှမ်းခေါက်ဆွဲ', price: 2500, categoryId: 2, isRecommended: true, spiceLevel: 1, options: [SPICE_OPTION, SIZE_OPTION, NOODLE_EXTRAS] },
      { id: 6, name: 'Pad Thai', nameMm: 'ပက်ထိုင်း', description: 'Thai-style stir-fried flat noodles with jumbo shrimp, bean sprouts, crushed peanuts & tamarind sauce.', descMm: 'ပုဇွန်နှင့် မြေပဲဖြင့် ကြော်ထားသော ခေါက်ဆွဲ', price: 3500, categoryId: 2, spiceLevel: 2, options: [SPICE_OPTION, NOODLE_EXTRAS] },
    ]
  },
  {
    id: 3, name: 'Grilled & Fried', nameMm: 'ကင်/ကြော်', emoji: '🍗',
    items: [
      { id: 7, name: 'Grilled Chicken', nameMm: 'ကြက်သား ကင်', description: 'Charcoal-grilled marinated chicken thigh with house-made chili dipping sauce. Smoky & juicy.', descMm: 'မီးသွေးဖြင့် ကင်ထားသော ကြက်သား', price: 4000, categoryId: 3, isRecommended: true, spiceLevel: 2, options: [SPICE_OPTION, GRILLED_EXTRAS] },
      { id: 8, name: 'Fish & Chips', nameMm: 'ငါးကြော်နှင့် အာလူးကြော်', description: 'Crispy beer-battered river fish fillet with golden thick-cut fries, tartar sauce & coleslaw.', descMm: 'ကြွပ်ကြွပ် ငါးကြော် နှင့် အာလူးကြော်', price: 5500, categoryId: 3, options: [GRILLED_EXTRAS] },
      { id: 9, name: 'Crispy Tofu', nameMm: 'တို့ဟူးကြော်', description: 'Golden deep-fried tofu cubes served with sweet chili dipping sauce and fresh herbs.', descMm: 'ချိုစပ်အရသာ တို့ဟူးကြော်', price: 2000, categoryId: 3, options: [SPICE_OPTION, GRILLED_EXTRAS] },
    ]
  },
  {
    id: 4, name: 'Soups & Curries', nameMm: 'ဟင်းချို/ဟင်းလျာ', emoji: '🥘',
    items: [
      { id: 10, name: 'Tom Yum Soup', nameMm: 'တုံရမ်ဟင်းချို', description: 'Fiery Thai lemongrass soup loaded with king prawns, mushrooms, kaffir lime & galangal.', descMm: 'ပုဇွန်ပါ ထိုင်းစပ်ဟင်းချို', price: 3500, categoryId: 4, isRecommended: true, spiceLevel: 3, options: [SPICE_OPTION, SIZE_OPTION] },
      { id: 11, name: 'Chicken Curry', nameMm: 'ကြက်သား ဟင်း', description: 'Rich Myanmar-style chicken curry slow-cooked with potato, onion & aromatic spices. Best with steamed rice.', descMm: 'မြန်မာ့ ကြက်သားဟင်း', price: 3000, categoryId: 4, spiceLevel: 2, options: [SPICE_OPTION, SIZE_OPTION] },
    ]
  },
  {
    id: 5, name: 'Salads', nameMm: 'အသုပ်များ', emoji: '🥗',
    items: [
      { id: 12, name: 'Tea Leaf Salad', nameMm: 'လက်ဖက်သုပ်', description: 'Myanmar\'s iconic fermented tea leaf salad tossed with crunchy nuts, seeds, tomatoes & dried shrimp.', descMm: 'မြန်မာ့ အထင်ကရ လက်ဖက်သုပ်', price: 2500, categoryId: 5, isRecommended: true, spiceLevel: 2, options: [SPICE_OPTION] },
      { id: 13, name: 'Ginger Salad', nameMm: 'ဂျင်းသုပ်', description: 'Fresh shredded ginger salad with chickpeas, toasted sesame seeds, peanuts & a tangy lime dressing.', descMm: 'ဂျင်းနှင့် ပဲသုပ်', price: 2000, categoryId: 5, spiceLevel: 1, options: [SPICE_OPTION] },
    ]
  },
  {
    id: 6, name: 'Drinks', nameMm: 'အချိုရည်များ', emoji: '🥤',
    items: [
      { id: 14, name: 'Myanmar Milk Tea', nameMm: 'လက်ဖက်ရည်', description: 'Classic Burmese milk tea brewed strong with sweet condensed milk.', descMm: 'မြန်မာ့ လက်ဖက်ရည်', price: 800, categoryId: 6, isRecommended: true, options: [SWEETNESS_OPTION, ICE_OPTION, DRINK_EXTRAS] },
      { id: 15, name: 'Fresh Lime Soda', nameMm: 'သံပုရာ ဆိုဒါ', description: 'Refreshing sparkling soda with freshly squeezed lime juice and a sprig of mint.', descMm: 'သံပုရာနှင့် ဆိုဒါ', price: 1200, categoryId: 6, options: [SWEETNESS_OPTION, ICE_OPTION, DRINK_EXTRAS] },
      { id: 16, name: 'Mango Smoothie', nameMm: 'သရက်သီး အချိုရည်', description: 'Creamy blended smoothie made from ripe Thai mangoes and a touch of coconut cream.', descMm: 'သရက်သီး ရောစပ်ဖျော်ရည်', price: 2000, categoryId: 6, isRecommended: true, options: [SWEETNESS_OPTION, ICE_OPTION, DRINK_EXTRAS] },
    ]
  },
  {
    id: 7, name: 'Desserts', nameMm: 'အချိုပွဲများ', emoji: '🍮',
    items: [
      { id: 17, name: 'Shwe Yin Aye', nameMm: 'ရွှေရင်အေး', description: 'Traditional Myanmar cold dessert — coconut jelly, sago, bread cubes & agar-agar in sweet coconut milk.', descMm: 'မြန်မာ့ ရိုးရာ ရွှေရင်အေး', price: 1500, categoryId: 7, isRecommended: true, options: [SWEETNESS_OPTION] },
      { id: 18, name: 'Mango Sticky Rice', nameMm: 'သရက်သီး ထမင်းပေါင်း', description: 'Ripe mango slices on sweet coconut sticky rice drizzled with coconut cream.', descMm: 'သရက်သီး ထမင်းပေါင်း', price: 2500, categoryId: 7, options: [] },
    ]
  },
]

export function getRecommended(): MenuItem[] {
  return categories.flatMap(c => c.items).filter(i => i.isRecommended)
}

export function formatMMK(amount: number): string {
  return new Intl.NumberFormat('en-US').format(amount) + ' Ks'
}

// Calculate extra price from selected options
export function calcExtras(item: MenuItem, singleOpts: Record<string, string>, multiOpts: Record<string, string[]>): number {
  let extra = 0
  item.options?.forEach(opt => {
    if (opt.type === 'single') {
      const selected = singleOpts[opt.id]
      const choice = opt.choices.find(c => c.value === selected)
      if (choice) extra += choice.extraPrice
    } else {
      const selected = multiOpts[opt.id] || []
      selected.forEach(val => {
        const choice = opt.choices.find(c => c.value === val)
        if (choice) extra += choice.extraPrice
      })
    }
  })
  return extra
}

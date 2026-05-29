export const COUNTRIES = [
  // Europa
  { value: 'NL', label: 'Nederland' },
  { value: 'BE', label: 'België' },
  { value: 'DE', label: 'Duitsland' },
  { value: 'FR', label: 'Frankrijk' },
  { value: 'ES', label: 'Spanje' },
  { value: 'IT', label: 'Italië' },
  { value: 'PT', label: 'Portugal' },
  { value: 'UK', label: 'Verenigd Koninkrijk' },
  { value: 'IE', label: 'Ierland' },
  { value: 'CH', label: 'Zwitserland' },
  { value: 'AT', label: 'Oostenrijk' },
  { value: 'SE', label: 'Zweden' },
  { value: 'NO', label: 'Noorwegen' },
  { value: 'DK', label: 'Denemarken' },
  { value: 'FI', label: 'Finland' },
  { value: 'PL', label: 'Polen' },
  { value: 'HU', label: 'Hongarije' },
  { value: 'CZ', label: 'Tsjechië' },
  { value: 'IS', label: 'IJsland' },
  { value: 'RO', label: 'Roemenië' },
  { value: 'BG', label: 'Bulgarije' },
  { value: 'TR', label: 'Turkije' },
  { value: 'GR', label: 'Griekenland' },
  { value: 'HR', label: 'Kroatië' },
  
  // Amerika
  { value: 'US', label: 'Verenigde Staten' },
  { value: 'CA', label: 'Canada' },
  { value: 'MX', label: 'Mexico' },
  { value: 'CO', label: 'Colombia' },
  { value: 'PE', label: 'Peru' },
  { value: 'AR', label: 'Argentinië' },
  { value: 'BR', label: 'Brazilië' },
  { value: 'CL', label: 'Chili' },
  { value: 'CR', label: 'Costa Rica' },
  { value: 'GT', label: 'Guatemala' },
  { value: 'BO', label: 'Bolivia' },
  { value: 'UY', label: 'Uruguay' },
  { value: 'DO', label: 'Dominicaanse Republiek' },
  { value: 'EC', label: 'Ecuador' },
  { value: 'PA', label: 'Panama' },

  // Azië
  { value: 'TH', label: 'Thailand' },
  { value: 'VN', label: 'Vietnam' },
  { value: 'ID', label: 'Indonesië' },
  { value: 'MY', label: 'Maleisië' },
  { value: 'PH', label: 'Filipijnen' },
  { value: 'LA', label: 'Laos' },
  { value: 'KH', label: 'Cambodja' },
  { value: 'JP', label: 'Japan' },
  { value: 'KR', label: 'Zuid-Korea' },
  { value: 'CN', label: 'China' },
  { value: 'SG', label: 'Singapore' },
  { value: 'TW', label: 'Taiwan' },
  { value: 'IN', label: 'India' },
  { value: 'NP', label: 'Nepal' },
  { value: 'LK', label: 'Sri Lanka' },

  // Oceanië
  { value: 'AU', label: 'Australië' },
  { value: 'NZ', label: 'Nieuw-Zeeland' },
  
  // Afrika & Midden-Oosten
  { value: 'ZA', label: 'Zuid-Afrika' },
  { value: 'MA', label: 'Marokko' },
  { value: 'EG', label: 'Egypte' },
  { value: 'TZ', label: 'Tanzania' },
  { value: 'KE', label: 'Kenia' },
  { value: 'AE', label: 'Verenigde Arabische Emiraten' },
  { value: 'IL', label: 'Israël' },
  
  // Anders
  { value: 'OT', label: 'Anders' }
].sort((a, b) => a.value === 'OT' ? 1 : b.value === 'OT' ? -1 : a.label.localeCompare(b.label));

export const LANGUAGES = [
  // Globale talen
  { value: 'NL', label: 'Nederlands' },
  { value: 'EN', label: 'Engels' },
  { value: 'FR', label: 'Frans' },
  { value: 'DE', label: 'Duits' },
  { value: 'ES', label: 'Spaans' },
  { value: 'IT', label: 'Italiaans' },
  { value: 'PT', label: 'Portugees' },
  
  // Europese talen
  { value: 'SV', label: 'Zweeds' },
  { value: 'NO', label: 'Noors' },
  { value: 'DA', label: 'Deens' },
  { value: 'FI', label: 'Fins' },
  { value: 'PL', label: 'Pools' },
  { value: 'HU', label: 'Hongaars' },
  { value: 'CS', label: 'Tsjechisch' },
  { value: 'IS', label: 'IJslands' },
  { value: 'RO', label: 'Roemeens' },
  { value: 'BG', label: 'Bulgaars' },
  { value: 'TR', label: 'Turks' },
  { value: 'EL', label: 'Grieks' },
  { value: 'HR', label: 'Kroatisch' },
  
  // Aziatische talen
  { value: 'TH', label: 'Thais' },
  { value: 'VI', label: 'Vietnamees' },
  { value: 'ID', label: 'Indonesisch' },
  { value: 'MS', label: 'Maleis' },
  { value: 'TL', label: 'Tagalog / Filipijns' },
  { value: 'LO', label: 'Laotiaans' },
  { value: 'KM', label: 'Khmer' },
  { value: 'JA', label: 'Japans' },
  { value: 'KO', label: 'Koreaans' },
  { value: 'ZH', label: 'Chinees (Mandarijn)' },
  { value: 'HI', label: 'Hindi' },
  { value: 'NE', label: 'Nepalees' },
  { value: 'SI', label: 'Singalees' },
  { value: 'TA', label: 'Tamil' },
  
  // Afrikaans & Midden-Oosten
  { value: 'AF', label: 'Afrikaans' },
  { value: 'AR', label: 'Arabisch' },
  { value: 'SW', label: 'Swahili' },
  { value: 'HE', label: 'Hebreeuws' },

  // Anders
  { value: 'OT', label: 'Anders' }
].sort((a, b) => a.value === 'OT' ? 1 : b.value === 'OT' ? -1 : a.label.localeCompare(b.label));

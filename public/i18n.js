// English / Malayalam for the patient pages.
//   <el data-t>English text</el>         text replaced using the English text as the key
//   <el data-t-key="name">…</el>         HTML replaced from HTML_ML[name] (for text with markup inside)
//   <input data-t-ph placeholder="…">    placeholder translated
//   t('English text', { var: value })    for messages built in JavaScript (and server messages)
// The choice is remembered on the phone; English is the default.
(function () {
  const TEXT_ML = {
    // Common
    'Welcome': 'സ്വാഗതം',
    'Enter the mobile number.': 'മൊബൈൽ നമ്പർ നൽകുക.',
    'Mobile number': 'മൊബൈൽ നമ്പർ',
    'Continue': 'തുടരുക',
    'Loading…': 'ലോഡ് ചെയ്യുന്നു…',
    '← Back': '← തിരികെ',
    'Privacy policy': 'സ്വകാര്യതാ നയം',
    'Done': 'ശരി',
    // OTP (when switched on)
    'Enter verification code': 'സ്ഥിരീകരണ കോഡ് നൽകുക',
    'Verification code': 'സ്ഥിരീകരണ കോഡ്',
    'Verify & continue': 'സ്ഥിരീകരിച്ച് തുടരുക',
    'Change number': 'നമ്പർ മാറ്റുക',
    'Resend code': 'കോഡ് വീണ്ടും അയയ്ക്കുക',
    'Enter the 6-digit code.': '6 അക്ക കോഡ് നൽകുക.',
    // Install
    'Add the app to your phone': 'ആപ്പ് നിങ്ങളുടെ ഫോണിൽ ചേർക്കുക',
    'Open it from your home screen next time.': 'അടുത്ത തവണ ഹോം സ്ക്രീനിൽ നിന്ന് തുറക്കാം.',
    'Install': 'ഇൻസ്റ്റാൾ',
    'Tap the Share button, then "Add to Home Screen".': 'ഷെയർ ബട്ടൺ അമർത്തി "Add to Home Screen" തിരഞ്ഞെടുക്കുക.',
    // Rules
    'Rules to follow during your healing': 'ഹീലിംഗ് സമയത്ത് പാലിക്കേണ്ട നിയമങ്ങൾ',
    'Please follow these rules': 'ദയവായി ഈ നിയമങ്ങൾ പാലിക്കുക',
    'Do not hate or keep grudges against anyone.': 'ആരെയും വെറുക്കുകയോ ആരോടും പക വെക്കുകയോ ചെയ്യരുത്.',
    'Eat only when hungry. Stop eating when you stop feeling hungry.': 'വിശക്കുമ്പോൾ മാത്രം ഭക്ഷണം കഴിക്കുക. വിശപ്പ് മാറുമ്പോൾ കഴിക്കുന്നത് നിർത്തുക.',
    'Drink only when thirsty. Stop drinking when you stop feeling thirsty.': 'ദാഹിക്കുമ്പോൾ മാത്രം കുടിക്കുക. ദാഹം മാറുമ്പോൾ കുടിക്കുന്നത് നിർത്തുക.',
    'Rest when your body asks for it.': 'ശരീരം ആവശ്യപ്പെടുമ്പോൾ വിശ്രമിക്കുക.',
    'Sleep early.': 'നേരത്തെ ഉറങ്ങുക.',
    // Choose patient
    '← Change number': '← നമ്പർ മാറ്റുക',
    'Who is the patient?': 'രോഗി ആരാണ്?',
    '+ Add a new patient': '+ പുതിയ രോഗിയെ ചേർക്കുക',
    'Full name': 'പൂർണ്ണ പേര്',
    'Age': 'പ്രായം',
    'Gender': 'ലിംഗം',
    'Female': 'സ്ത്രീ',
    'Male': 'പുരുഷൻ',
    'Other': 'മറ്റുള്ളവർ',
    'Add & continue': 'ചേർത്ത് തുടരുക',
    'No patients are registered under {phone} yet. Add the patient below.': '{phone} എന്ന നമ്പറിൽ ഇതുവരെ ആരെയും രജിസ്റ്റർ ചെയ്തിട്ടില്ല. താഴെ രോഗിയെ ചേർക്കുക.',
    '{n} patient registered under {phone}.': '{phone} എന്ന നമ്പറിൽ {n} പേർ രജിസ്റ്റർ ചെയ്തിട്ടുണ്ട്.',
    '{n} patients registered under {phone}.': '{phone} എന്ന നമ്പറിൽ {n} പേർ രജിസ്റ്റർ ചെയ്തിട്ടുണ്ട്.',
    '{n} yrs': '{n} വയസ്സ്',
    // Photo page
    '← Choose another patient': '← മറ്റൊരു രോഗിയെ തിരഞ്ഞെടുക്കുക',
    'See my progress →': 'എന്റെ പുരോഗതി കാണുക →',
    'Your photo': 'നിങ്ങളുടെ ഫോട്ടോ',
    'How to take the photo': 'ഫോട്ടോ എടുക്കേണ്ട വിധം',
    'Example photo': 'ഉദാഹരണ ഫോട്ടോ',
    '🧘 Sit comfortably with your eyes closed.': '🧘 കണ്ണുകൾ അടച്ച് സുഖമായി ഇരിക്കുക.',
    '🤲 Keep your palms facing upwards on your lap.': '🤲 കൈപ്പത്തികൾ മുകളിലേക്ക് തിരിച്ച് മടിയിൽ വെക്കുക.',
    '📍 Remember where you are sitting – you will return to this spot when the healing starts.': '📍 ഇരിക്കുന്ന സ്ഥലം ഓർത്തുവെക്കുക – ഹീലിംഗ് തുടങ്ങുമ്പോൾ ഇതേ സ്ഥലത്തേക്ക് മടങ്ങിവരണം.',
    "Ask someone to take the photo for you, or use your camera's timer.": 'മറ്റൊരാളോട് ഫോട്ടോ എടുത്തുതരാൻ പറയുക, അല്ലെങ്കിൽ ക്യാമറയുടെ ടൈമർ ഉപയോഗിക്കുക.',
    'Tap to change photo': 'ഫോട്ടോ മാറ്റാൻ ടാപ്പ് ചെയ്യുക',
    'What problems are you facing?': 'നിങ്ങൾ നേരിടുന്ന പ്രശ്നങ്ങൾ എന്തൊക്കെയാണ്?',
    'Your illness or symptoms, and how long you have had them…': 'നിങ്ങളുടെ അസുഖമോ ലക്ഷണങ്ങളോ, എത്ര കാലമായി ഉണ്ടെന്നും…',
    'What treatments have you already tried?': 'ഇതിനകം ഏതൊക്കെ ചികിത്സകൾ ചെയ്തു?',
    'What medicines are you taking now?': 'ഇപ്പോൾ കഴിക്കുന്ന മരുന്നുകൾ ഏതൊക്കെ?',
    '(optional)': '(നിർബന്ധമില്ല)',
    'e.g. allopathy, ayurveda, homeopathy, physiotherapy, surgery…': 'ഉദാ: അലോപ്പതി, ആയുർവേദം, ഹോമിയോപ്പതി, ഫിസിയോതെറാപ്പി, ശസ്ത്രക്രിയ…',
    'Medicine names and how often you take them. Write “None” if you take no medicines.': 'മരുന്നുകളുടെ പേരും എത്ര തവണ കഴിക്കുന്നു എന്നും. മരുന്നുകൾ ഇല്ലെങ്കിൽ “ഇല്ല” എന്ന് എഴുതുക.',
    'What positive changes are you feeling after your last healing?': 'കഴിഞ്ഞ ഹീലിംഗിന് ശേഷം എന്തൊക്കെ നല്ല മാറ്റങ്ങൾ അനുഭവപ്പെടുന്നു?',
    'For example: less pain, better sleep, more energy, feeling calmer…': 'ഉദാ: വേദന കുറഞ്ഞു, നന്നായി ഉറങ്ങുന്നു, കൂടുതൽ ഊർജ്ജം, മനസ്സിന് ശാന്തത…',
    'By ticking this box, I confirm that:': 'ഈ ബോക്സിൽ ടിക്ക് ചെയ്യുന്നതിലൂടെ ഞാൻ സ്ഥിരീകരിക്കുന്നു:',
    'I am the patient, or a parent, guardian or family member submitting with their permission.': 'ഞാൻ രോഗിയാണ്, അല്ലെങ്കിൽ രോഗിയുടെ അനുവാദത്തോടെ അയയ്ക്കുന്ന മാതാപിതാവോ രക്ഷിതാവോ കുടുംബാംഗമോ ആണ്.',
    'I understand this is a drugless therapy, and I am taking part willingly.': 'ഇത് മരുന്നില്ലാത്ത ചികിത്സയാണെന്ന് ഞാൻ മനസ്സിലാക്കുന്നു, സ്വമനസ്സാലെയാണ് ഞാൻ പങ്കെടുക്കുന്നത്.',
    'I understand that results vary and are not guaranteed.': 'ഫലങ്ങൾ ഓരോരുത്തർക്കും വ്യത്യസ്തമായിരിക്കുമെന്നും ഉറപ്പ് നൽകാനാവില്ലെന്നും ഞാൻ മനസ്സിലാക്കുന്നു.',
    'Read our privacy policy': 'ഞങ്ങളുടെ സ്വകാര്യതാ നയം വായിക്കുക',
    'Upload & continue to payment': 'അപ്‌ലോഡ് ചെയ്ത് പണമടയ്ക്കാൻ തുടരുക',
    'Upload & continue': 'അപ്‌ലോഡ് ചെയ്ത് തുടരുക',
    'Preparing photo…': 'ഫോട്ടോ തയ്യാറാക്കുന്നു…',
    'Uploading…': 'അപ്‌ലോഡ് ചെയ്യുന്നു…',
    'Please add a photo.': 'ദയവായി ഒരു ഫോട്ടോ ചേർക്കുക.',
    'Please describe the problems you are facing.': 'നിങ്ങൾ നേരിടുന്ന പ്രശ്നങ്ങൾ വിവരിക്കുക.',
    'Please tell us about the positive changes you are feeling.': 'അനുഭവപ്പെടുന്ന നല്ല മാറ്റങ്ങളെക്കുറിച്ച് പറയുക.',
    'Please tick the consent box to continue.': 'തുടരാൻ സമ്മത ബോക്സിൽ ടിക്ക് ചെയ്യുക.',
    // Payment page
    'Payment': 'പണമടയ്ക്കൽ',
    '✓ Photo & details sent': '✓ ഫോട്ടോയും വിവരങ്ങളും അയച്ചു',
    'Complete the payment to confirm your treatment.': 'ചികിത്സ ഉറപ്പാക്കാൻ പണമടയ്ക്കൽ പൂർത്തിയാക്കുക.',
    'Patient': 'രോഗി',
    'Total': 'ആകെ',
    'Amount to pay': 'അടയ്ക്കേണ്ട തുക',
    'Enter the amount you wish to pay.': 'നിങ്ങൾ അടയ്ക്കാൻ ആഗ്രഹിക്കുന്ന തുക നൽകുക.',
    'Any amount': 'ഏത് തുകയും',
    'Pay to': 'പണം ലഭിക്കുന്നത്:',
    'Copy': 'കോപ്പി',
    'Copied': 'കോപ്പി ചെയ്തു',
    'Scan with any UPI app. The amount is filled in automatically.': 'ഏത് UPI ആപ്പ് ഉപയോഗിച്ചും സ്കാൻ ചെയ്യുക. തുക തനിയെ ചേർക്കപ്പെടും.',
    'Scan with any UPI app and enter the amount in the app.': 'ഏത് UPI ആപ്പ് ഉപയോഗിച്ചും സ്കാൻ ചെയ്ത് ആപ്പിൽ തുക നൽകുക.',
    'Any UPI app': 'ഏത് UPI ആപ്പും',
    'Pay with UPI app on this phone': 'ഈ ഫോണിലെ UPI ആപ്പ് വഴി പണമടയ്ക്കുക',
    "If the button doesn't work, take a screenshot of the QR code and open it in your UPI app (Scan → choose from gallery).": 'ബട്ടൺ പ്രവർത്തിക്കുന്നില്ലെങ്കിൽ QR കോഡിന്റെ സ്ക്രീൻഷോട്ട് എടുത്ത് UPI ആപ്പിൽ തുറക്കുക (Scan → ഗാലറിയിൽ നിന്ന് തിരഞ്ഞെടുക്കുക).',
    'I have paid': 'ഞാൻ പണമടച്ചു',
    '🔒 Secure payment by Razorpay': '🔒 Razorpay വഴി സുരക്ഷിതമായ പണമടയ്ക്കൽ',
    'Pay {amount}': '{amount} അടയ്ക്കുക',
    'Enter an amount to pay': 'അടയ്ക്കേണ്ട തുക നൽകുക',
    'Opening payment…': 'പണമടയ്ക്കൽ തുറക്കുന്നു…',
    'Confirming payment…': 'പണമടയ്ക്കൽ സ്ഥിരീകരിക്കുന്നു…',
    'Payment was not completed. Tap the button to try again.': 'പണമടയ്ക്കൽ പൂർത്തിയായില്ല. വീണ്ടും ശ്രമിക്കാൻ ബട്ടൺ അമർത്തുക.',
    'Could not load the payment window. Check your internet connection and try again.': 'പണമടയ്ക്കൽ വിൻഡോ തുറക്കാനായില്ല. ഇന്റർനെറ്റ് കണക്ഷൻ പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക.',
    'Online payment is not set up yet. Your details have been received — please pay at the clinic.': 'ഓൺലൈൻ പണമടയ്ക്കൽ ഇതുവരെ ലഭ്യമല്ല. നിങ്ങളുടെ വിവരങ്ങൾ ലഭിച്ചു — ദയവായി ക്ലിനിക്കിൽ പണമടയ്ക്കുക.',
    'Finish': 'പൂർത്തിയാക്കുക',
    'Enter a valid amount (up to ₹1,00,000).': 'ശരിയായ തുക നൽകുക (₹1,00,000 വരെ).',
    // Final page
    'Photo successfully submitted for treatment': 'ചികിത്സയ്ക്കുള്ള ഫോട്ടോ വിജയകരമായി അയച്ചു',
    'When the healing starts at 10 PM': 'രാത്രി 10 മണിക്ക് ഹീലിംഗ് തുടങ്ങുമ്പോൾ',
    'Sit or lie down comfortably in the same spot where you were sitting when your photo was taken, close your eyes and relax.': 'ഫോട്ടോ എടുത്തപ്പോൾ ഇരുന്ന അതേ സ്ഥലത്ത് സുഖമായി ഇരിക്കുകയോ കിടക്കുകയോ ചെയ്യുക, കണ്ണുകൾ അടച്ച് വിശ്രമിക്കുക.',
    'Your next healing': 'നിങ്ങളുടെ അടുത്ത ഹീലിംഗ്',
    'Please send a new photo before 10 PM IST for your next session ({label}).': 'അടുത്ത സെഷനുവേണ്ടി ({label}) ഇന്ത്യൻ സമയം രാത്രി 10 മണിക്ക് മുമ്പ് പുതിയ ഫോട്ടോ അയയ്ക്കുക.',
    'Please send a new photo next week, on {date}, before 10 PM IST ({label}).': 'അടുത്ത ആഴ്ച, {date}-ന്, ഇന്ത്യൻ സമയം രാത്രി 10 മണിക്ക് മുമ്പ് പുതിയ ഫോട്ടോ അയയ്ക്കുക ({label}).',
    'Your UPI payment will be confirmed by us shortly.': 'നിങ്ങളുടെ UPI പണമടയ്ക്കൽ ഞങ്ങൾ ഉടൻ സ്ഥിരീകരിക്കും.',
    'See my progress': 'എന്റെ പുരോഗതി കാണുക',
    '{label} · 12-session course': '{label} · 12 സെഷൻ കോഴ്സ്',
    'Your 12-session healing course is complete.': 'നിങ്ങളുടെ 12 സെഷൻ ഹീലിംഗ് കോഴ്സ് പൂർത്തിയായി.',
    'Your 12 weekly sessions are complete.': 'നിങ്ങളുടെ 12 പ്രതിവാര സെഷനുകൾ പൂർത്തിയായി.',
    'Next: 12 weekly sessions, one a week': 'അടുത്തത്: ആഴ്ചയിൽ ഒന്ന് വീതം 12 പ്രതിവാര സെഷനുകൾ',
    'Next: a new 12-session healing course': 'അടുത്തത്: പുതിയ 12 സെഷൻ ഹീലിംഗ് കോഴ്സ്',
    // My progress
    'My progress': 'എന്റെ പുരോഗതി',
    "Send today's photo": 'ഇന്നത്തെ ഫോട്ടോ അയയ്ക്കുക',
    'Send my first photo': 'എന്റെ ആദ്യ ഫോട്ടോ അയയ്ക്കുക',
    'My sessions': 'എന്റെ സെഷനുകൾ',
    'session done': 'സെഷൻ പൂർത്തിയായി',
    'sessions done': 'സെഷനുകൾ പൂർത്തിയായി',
    'Now': 'ഇപ്പോൾ',
    'Next': 'അടുത്തത്',
    'Weekly sessions': 'പ്രതിവാര സെഷനുകൾ',
    '12-session course': '12 സെഷൻ കോഴ്സ്',
    '12-session course #{n}': '12 സെഷൻ കോഴ്സ് #{n}',
    'Before 10 PM IST': 'ഇന്ത്യൻ സമയം രാത്രി 10-ന് മുമ്പ്',
    '{date}, before 10 PM IST': '{date}, രാത്രി 10-ന് മുമ്പ്',
    'You have not started yet. Send your first photo to begin your 12-session healing course.': 'നിങ്ങൾ ഇതുവരെ തുടങ്ങിയിട്ടില്ല. 12 സെഷൻ ഹീലിംഗ് കോഴ്സ് തുടങ്ങാൻ ആദ്യ ഫോട്ടോ അയയ്ക്കുക.',
    // Offline page
    'No internet connection': 'ഇന്റർനെറ്റ് കണക്ഷൻ ഇല്ല',
    'Please check your mobile data or Wi-Fi and try again.': 'മൊബൈൽ ഡാറ്റയോ Wi-Fi-യോ പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക.',
    'Try again': 'വീണ്ടും ശ്രമിക്കുക',
    // Messages from the server
    'Enter a valid 10-digit mobile number.': 'ശരിയായ 10 അക്ക മൊബൈൽ നമ്പർ നൽകുക.',
    'Name is required.': 'പേര് നിർബന്ധമാണ്.',
    'Enter a valid age.': 'ശരിയായ പ്രായം നൽകുക.',
    'Patient not found.': 'രോഗിയെ കണ്ടെത്തിയില്ല.',
    'Visit not found.': 'സെഷൻ കണ്ടെത്തിയില്ല.',
    'Please upload a photo.': 'ദയവായി ഒരു ഫോട്ടോ അപ്‌ലോഡ് ചെയ്യുക.',
    'Please upload a JPG, PNG, WEBP or HEIC photo.': 'JPG, PNG, WEBP അല്ലെങ്കിൽ HEIC ഫോട്ടോ അപ്‌ലോഡ് ചെയ്യുക.',
    'Photo is too large (max 15 MB).': 'ഫോട്ടോ വളരെ വലുതാണ് (പരമാവധി 15 MB).',
    'Too many attempts. Please try again in an hour.': 'ഒരുപാട് ശ്രമങ്ങൾ. ഒരു മണിക്കൂർ കഴിഞ്ഞ് വീണ്ടും ശ്രമിക്കുക.',
    'Too many uploads. Please try again in an hour.': 'ഒരുപാട് അപ്‌ലോഡുകൾ. ഒരു മണിക്കൂർ കഴിഞ്ഞ് വീണ്ടും ശ്രമിക്കുക.',
    'Too many new patients added. Please try again in an hour.': 'ഒരുപാട് പുതിയ രോഗികളെ ചേർത്തു. ഒരു മണിക്കൂർ കഴിഞ്ഞ് വീണ്ടും ശ്രമിക്കുക.',
    'Something went wrong. Please try again.': 'എന്തോ പിശക് സംഭവിച്ചു. വീണ്ടും ശ്രമിക്കുക.',
    'Please verify your mobile number first.': 'ആദ്യം നിങ്ങളുടെ മൊബൈൽ നമ്പർ സ്ഥിരീകരിക്കുക.',
  };

  // Text with markup inside (kept separate so the HTML stays intact).
  const HTML_ML = {
    photoDrop: '📷 ഫോട്ടോ എടുക്കാനോ അപ്‌ലോഡ് ചെയ്യാനോ ടാപ്പ് ചെയ്യുക<br><small>JPG, PNG അല്ലെങ്കിൽ HEIC, 15 MB വരെ</small>',
    consentShare: 'എന്റെ ഹീലിംഗ് സെഷനുവേണ്ടി ഈ ഫോട്ടോയും വിവരങ്ങളും <span data-clinic>Suhail&#39;s Meridian Healing</span>-മായി പങ്കുവെക്കാൻ ഞാൻ സമ്മതിക്കുന്നു.',
    treatmentTime: 'ചികിത്സ <strong>ഇന്ത്യൻ സമയം രാത്രി 10 മണിക്ക്</strong> ആരംഭിക്കും.',
  };

  let lang = 'en';
  try { lang = localStorage.getItem('lang') === 'ml' ? 'ml' : 'en'; } catch {}
  const ml = lang === 'ml';

  function fill(text, vars) {
    return vars ? text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : text;
  }

  // Translate a message; plan labels such as "Session 3 of 12" are handled too.
  function t(text, vars) {
    if (!ml || text == null) return fill(String(text ?? ''), vars);
    let m;
    if ((m = /^Weekly session (\d+) of (\d+)$/.exec(text))) return `പ്രതിവാര സെഷൻ ${m[1]} / ${m[2]}`;
    if ((m = /^Session (\d+) of (\d+)$/.exec(text))) return `സെഷൻ ${m[1]} / ${m[2]}`;
    if ((m = /^Session (\d+)$/.exec(text))) return `സെഷൻ ${m[1]}`;
    return fill(TEXT_ML[text] || text, vars);
  }

  function apply(root) {
    if (!ml) return;
    const norm = (s) => s.replace(/\s+/g, ' ').trim();
    root.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(norm(el.textContent)); });
    root.querySelectorAll('[data-t-key]').forEach((el) => { if (HTML_ML[el.dataset.tKey]) el.innerHTML = HTML_ML[el.dataset.tKey]; });
    root.querySelectorAll('[data-t-ph]').forEach((el) => { el.placeholder = t(norm(el.placeholder)); });
    root.querySelectorAll('select[data-t-options] option').forEach((o) => { o.textContent = t(o.textContent); });
  }

  // Language switch in the page header.
  function addSwitch() {
    const header = document.querySelector('header.brand');
    if (!header) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lang-switch';
    btn.textContent = ml ? 'English' : 'മലയാളം';
    btn.setAttribute('aria-label', ml ? 'Switch to English' : 'Switch to Malayalam');
    btn.addEventListener('click', () => {
      try { localStorage.setItem('lang', ml ? 'en' : 'ml'); } catch {}
      location.reload();
    });
    header.appendChild(btn);
  }

  document.documentElement.lang = ml ? 'ml' : 'en';
  window.LANG = lang;
  window.LOCALE = ml ? 'ml-IN' : 'en-IN';
  window.t = t;
  window.applyI18n = apply;
  apply(document);
  addSwitch();
})();

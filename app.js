const API_URL = "https://script.google.com/macros/s/AKfycbxXffGd4V-8GslsyEK056NVod-7nPCWTwsNFG6lFqTn9GFAl8oLCgHUU_OA6ej3uLw_kw/exec";

        let expenseChartInstance = null; window.tarihceData = []; window.currentStats = {};
        window.hesapOptions = ""; window.vadesizOptions = ""; window.hesapTurleri = { "Nakit": "Nakit" }; 
        window.sabitDataRaw = [];
        window.dinamikKategoriler = { gider: [], gelir: [], hareketTurleri: [], odemeTurleri: [], borcTurleri: [], varlikKategorileri: [] };

        const gunler = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

                function switchTab(tabId, el) {
            document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            
            document.getElementById('section-' + tabId).classList.add('active');
            el.classList.add('active');
            
            // DÜZELTME: Smooth (yumuşak) kaydırma iptal edildi. 
            // Anında üste atar, ekranı kilitlemez ve ilk dokunuşta kartlar açılır!
            window.scrollTo(0, 0); 
            if (window.navigator.vibrate) window.navigator.vibrate(10);
            
            if (tabId === 'islemler' && expenseChartInstance) {
                setTimeout(() => { expenseChartInstance.update(); }, 100);
            }
        }

        const setHtml = (id, html) => { const el = document.getElementById(id); if(el) el.innerHTML = html; };
        const setText = (id, text) => { const el = document.getElementById(id); if(el) el.innerText = text; };

        function vibe() { /* iOS PWA uyumsuzluğu nedeniyle iptal edildi */ }

        function initAccordions() { document.querySelectorAll('.accordion').forEach(el => { if (el.id && localStorage.getItem(el.id) === "1") el.classList.add("collapsed"); }); }

        document.addEventListener("DOMContentLoaded", () => { initAccordions(); });

        function toggleAccordion(element) { element.classList.toggle("collapsed"); if(element.id) { localStorage.setItem(element.id, element.classList.contains("collapsed") ? "1" : "0"); } }
        function turkceEkBul(sayi) { sayi = parseInt(sayi); const sonRakam = sayi % 10; const sonIkiRakam = sayi % 100; 
                                     if (sayi === 0) return "'ı"; if ([10,30,40,60,90].includes(sonIkiRakam)) return "'u"; if ([50,80].includes(sonIkiRakam)) return "'i"; if ([20,70].includes(sonIkiRakam)) return "'si"; 
                                     switch (sonRakam) { case 1: case 5: case 8: return "'i"; case 2: case 7: return "'si"; 
                                     case 3: case 4: return "'ü"; case 6: return "'sı"; case 9: return "'u"; default: return "'u"; } }

        let touchStart = 0; const pullIndicator = document.getElementById('pull-indicator');
        document.addEventListener('touchstart', e => { if (window.scrollY <= 0 && !document.getElementById('action-modal').classList.contains('active')) touchStart = e.touches[0].pageY; }, {passive: true});
        document.addEventListener('touchmove', e => { if (window.scrollY <= 0 && touchStart > 0) { const diff = e.touches[0].pageY - touchStart; if (diff > 0) { const h = Math.min(diff * 0.4, 60); pullIndicator.style.height = h + 'px'; if (h > 50) pullIndicator.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; transform: rotate(180deg); transition: 0.2s;"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg> Bırakın güncellensin'; else pullIndicator.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; transition: 0.2s;"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg> Aşağı çek...'; } } }, {passive: true});
        document.addEventListener('touchend', async e => { if (parseInt(pullIndicator.style.height) > 50) { pullIndicator.innerHTML = '<span class="spinner"></span> Güncelleniyor...'; vibe(); await verileriCek(); } pullIndicator.style.height = '0px'; touchStart = 0; });

        function formatTL(sayi) {
            if (isNaN(sayi) || sayi === null || sayi === "") return `<span style="font-size:0.7em; opacity:0.6; font-weight:600;">₺</span>0<span style="font-size:0.7em; opacity:0.6; font-weight:600;">,00</span>`;
            let isNegative = sayi < 0;
            let absoluteSayi = Math.abs(sayi);
            let formatted = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(absoluteSayi);
            let parts = formatted.split(',');
            let sign = isNegative ? "-" : "";
            return `${sign}<span style="font-size:0.75em; opacity:0.75; font-weight:600; margin-right:2px;">₺</span>${parts[0]}<span style="font-size:0.75em; opacity:0.75; font-weight:600;">,${parts[1]}</span>`;
        }
        function formatTLTam(sayi) {
            if (isNaN(sayi) || sayi === null || sayi === "") return `<span style="font-size:0.7em; opacity:0.6; font-weight:600;">₺</span>0`;
            let isNegative = sayi < 0;
            let absoluteSayi = Math.abs(sayi);
            let formatted = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(absoluteSayi);
            let sign = isNegative ? "-" : "";
            return `${sign}<span style="font-size:0.75em; opacity:0.75; font-weight:600; margin-right:2px;">₺</span>${formatted}`;
        }
        function formatUSD(sayi) { if (isNaN(sayi) || sayi === null || sayi === "") return `<span style="font-size:0.8em; opacity:0.7; font-weight:600; margin-right:2px;">$</span>0<span style="font-size:0.8em; opacity:0.7; font-weight:600;">,00</span>`; 
                                   let formatted = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(sayi); let parts = formatted.split(','); 
                                   return `<span style="font-size:0.8em; opacity:0.7; font-weight:600; margin-right:2px;">$</span>${parts[0]}<span style="font-size:0.8em; opacity:0.7; font-weight:600;">,${parts[1]}</span>`; }
        const parseSaha = (val) => { 
    if (typeof val === 'number') return val; 
    if (!val) return 0; 
    
    // 1. Temizlik: Para sembolü ve boşluklar gider
    let s = val.toString().replace(/₺/g, "").replace(/\s/g, ""); 
    
    // 2. HEM NOKTA HEM VİRGÜL VARSA (Örn: 1.250,50)
    // Nokta binliktir (sil), virgül ondalıktır (noktaya çevir)
    if (s.includes('.') && s.includes(',')) {
        s = s.split('.').join('').replace(',', '.');
    } 
    // 3. SADECE VİRGÜL VARSA (Örn: 532,18)
    // Bu kesinlikle kuruş ayracıdır
    else if (s.includes(',')) {
        s = s.replace(',', '.');
    } 
    // 4. SADECE NOKTA VARSA (KRİTİK EMEK VERİLEN TAHMİN KISMI)
    else if (s.includes('.')) {
        let parts = s.split('.');
        // Eğer noktanın sağında 3 rakam varsa (Örn: 9.650) binliktir, sileriz.
        // Eğer 1 veya 2 rakam varsa (Örn: 10.5) kuruş ayracıdır, dokunmayız.
        if (parts[parts.length - 1].length > 2) { 
            s = s.split('.').join(''); 
        }
    }
    
    // 5. Sayıya çevir ve hata kontrolü yap
    let sonuc = parseFloat(s);
    return isNaN(sonuc) ? 0 : sonuc; 
};

        function animateValue(id, endValue, duration) { const obj = document.getElementById(id); if(!obj || isNaN(endValue)) return; let startTimestamp = null; 
                                                        const step = (timestamp) => { if (!startTimestamp) startTimestamp = timestamp; const progress = Math.min((timestamp - startTimestamp) / duration, 1); 
                                                        const easeProgress = 1 - Math.pow(1 - progress, 4); const currentVal = endValue * easeProgress; obj.innerHTML = formatTLTam(currentVal); 
                                                        if (progress < 1) window.requestAnimationFrame(step); else obj.innerHTML = formatTLTam(endValue); }; window.requestAnimationFrame(step); }
        function animateValueUSD(id, endValue, duration) { const obj = document.getElementById(id); if(!obj || isNaN(endValue)) return; let startTimestamp = null; 
                                                           const step = (timestamp) => { if (!startTimestamp) startTimestamp = timestamp; const progress = Math.min((timestamp - startTimestamp) / duration, 1); 
                                                           const easeProgress = 1 - Math.pow(1 - progress, 4); const currentVal = endValue * easeProgress; obj.innerHTML = formatUSD(currentVal); 
                                                           if (progress < 1) window.requestAnimationFrame(step); else obj.innerHTML = formatUSD(endValue); }; window.requestAnimationFrame(step); }

                function updateTrends(days, btnElement) {
            document.querySelectorAll('.time-btn').forEach(btn => btn.classList.remove('active'));
            if(btnElement) btnElement.classList.add('active');

                        const ids = ['trend-net-servet', 'trend-net-servet-usd', 'trend-borc', 'trend-can-yakan', 'trend-planli', 'trend-faiz', 'trend-kasa', 'trend-kart', 'trend-toplam-varlik', 'trend-dolar-kuru', 'trend-borc-varlik', 'trend-nakit-koruma', 'trend-saf-harcama', 'trend-gunluk-ortalama', 'trend-net-kalan', 'trend-header-varlik', 'trend-header-borc'];
            if (days === 0) { ids.forEach(id => { setHtml(id, ""); }); return; }

            if(!window.tarihceData || window.tarihceData.length < 2) {
                ids.forEach(id => { setHtml(id, `<span style="color:var(--text-muted); font-weight:500;">Veri yok</span>`); });
                return;
            }

            function parseTarihceDate(rawStr) {
                if (!rawStr) return 0;
                if (rawStr instanceof Date) return rawStr.getTime();
                let s = rawStr.toString().trim();
                if (s.includes('.')) { 
                    let parts = s.split(' ')[0].split('.'); 
                    if (parts.length === 3) return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10)).getTime(); 
                }
                let t = new Date(s).getTime(); return isNaN(t) ? 0 : t;
            }

            const now = new Date(); 
            const midnightToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const targetTime = midnightToday - ((days - 1) * 24 * 60 * 60 * 1000);
            
            let gecmisKayitlar = window.tarihceData.filter(row => { let t = parseTarihceDate(row[0]); return t > 0 && t <= targetTime; });
            let bestRow = null;
            if (gecmisKayitlar.length > 0) {
                bestRow = gecmisKayitlar[gecmisKayitlar.length - 1]; 
            } else if (window.tarihceData.length > 1) {
                bestRow = window.tarihceData[1]; 
            } else {
                return; 
            }

            let pastToplamVarlik = parseSaha(bestRow[1]); 
            let pastNetServet    = parseSaha(bestRow[2]); 
            let pastBorc         = parseSaha(bestRow[3]); 
            let pastCanYakan     = parseSaha(bestRow[4]); 
            let pastPlanli       = parseSaha(bestRow[5]); 
            let pastFaiz         = parseSaha(bestRow[6]); 
            let pastKasa         = parseSaha(bestRow[7]); 
            let pastKart         = parseSaha(bestRow[8]); 
            let pastDolarKuru    = parseSaha(bestRow[9]) || 1; 
            let pastKoruma       = parseSaha(bestRow[10]); 
            let pastOran         = parseSaha(bestRow[11]);
            let pastSafHarcama   = parseSaha(bestRow[12]);
            let pastGunlukOrt    = parseSaha(bestRow[13]);
            let pastNetKalan     = parseSaha(bestRow[14]);

            let pastNetServetUSD = pastNetServet / pastDolarKuru; 

            // === GÜNCELLEME: Borç kalemlerinde Math.abs (Mutlak Değer) kullanılarak büyüklük kontrolü yapılır ===
            if(document.getElementById('trend-toplam-varlik')) renderTrend('trend-toplam-varlik', window.currentStats.toplamVarlik, pastToplamVarlik, false);
            if(document.getElementById('trend-net-servet')) renderTrend('trend-net-servet', window.currentStats.netServet, pastNetServet, false);
            if(document.getElementById('trend-net-servet-usd')) renderTrend('trend-net-servet-usd', window.currentStats.netServetUSD, pastNetServetUSD, false, '$');
            if(document.getElementById('trend-header-varlik')) renderTrend('trend-header-varlik', window.currentStats.toplamVarlik, pastToplamVarlik, false);
            if(document.getElementById('trend-header-borc')) renderTrend('trend-header-borc', Math.abs(window.currentStats.toplamBorc), Math.abs(pastBorc), true);
            
            // Borç/Gider trendleri (Mutlak değer zırhı eklendi)
            if(document.getElementById('trend-borc')) renderTrend('trend-borc', Math.abs(window.currentStats.toplamBorc), Math.abs(pastBorc), true);
            if(document.getElementById('trend-can-yakan')) renderTrend('trend-can-yakan', Math.abs(window.currentStats.toplamCanYakan), Math.abs(pastCanYakan), true);
            if(document.getElementById('trend-planli')) renderTrend('trend-planli', Math.abs(window.currentStats.toplamPlanli), Math.abs(pastPlanli), true);
            if(document.getElementById('trend-faiz')) renderTrend('trend-faiz', Math.abs(window.currentStats.tahminiFaiz), Math.abs(pastFaiz), true);
            if(document.getElementById('trend-kart')) renderTrend('trend-kart', Math.abs(window.currentStats.kartToplam), Math.abs(pastKart), true);
            if(document.getElementById('trend-saf-harcama')) renderTrend('trend-saf-harcama', Math.abs(window.currentStats.safHarcama), Math.abs(pastSafHarcama), true);
            if(document.getElementById('trend-gunluk-ortalama')) renderTrend('trend-gunluk-ortalama', Math.abs(window.currentStats.gunlukOrt), Math.abs(pastGunlukOrt), true);

            if(document.getElementById('trend-kasa')) renderTrend('trend-kasa', window.currentStats.toplamKasa, pastKasa, false);
            if(document.getElementById('trend-dolar-kuru')) renderTrend('trend-dolar-kuru', window.currentStats.usdRate, pastDolarKuru, false, '₺');

            let guncelOran = 0;
            if(window.currentStats.borcVarlikOrani) {
                guncelOran = parseFloat(window.currentStats.borcVarlikOrani.toString().replace('%', '')) || 0;
            }
            let pastOranYuzde = pastOran < 1 ? pastOran * 100 : pastOran; 
            
            if(document.getElementById('trend-borc-varlik')) renderTrend('trend-borc-varlik', guncelOran, pastOranYuzde, true, '%');
            if(document.getElementById('trend-nakit-koruma')) renderTrend('trend-nakit-koruma', window.currentStats.nakitKorumaSuresi, pastKoruma, false, '');
            if(document.getElementById('trend-net-kalan')) renderTrend('trend-net-kalan', window.currentStats.netKalan, pastNetKalan, false);
        }

        function renderTrend(elementId, current, past, isDebt, symbol = '₺') {
            const diff = current - past; const el = document.getElementById(elementId); if(!el) return;
            if (Math.abs(diff) < 1) { el.innerHTML = `<span style="color:var(--text-muted); font-weight:500;">━ Sabit</span>`; return; }
            const formattedDiff = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(diff));
            let color = (diff > 0) ? (isDebt ? "var(--rose)" : "var(--emerald)") : (isDebt ? "var(--emerald)" : "var(--rose)");
            let icon = (diff > 0) ? "▲" : "▼";
            el.innerHTML = `<span style="color:${color}; background:color-mix(in srgb, ${color} 15%, transparent); padding: 3px 6px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); border: 1px solid color-mix(in srgb, ${color} 30%, transparent);">${icon} ${symbol}${formattedDiff}</span>`;
        }

        function getFormattedDateTime(inputId) {
            const val = document.getElementById(inputId).value; if(!val) return ""; const d = new Date(val);
            return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth()+1).padStart(2, '0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }

        function setNow(inputId) {
            const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            const el = document.getElementById(inputId); if(el) el.value = now.toISOString().slice(0,16);
        }

        function toggleModal() {
            vibe();
            const modal = document.getElementById('action-modal'); const btn = document.getElementById('fab-btn');
            modal.classList.toggle('active');
            
            if(modal.classList.contains('active')) {
                btn.classList.add('open');
                document.body.classList.add('modal-open');
                showSection('section-menu', 'Ne yapmak istersin?');
            } else {
                btn.classList.remove('open');
                document.body.classList.remove('modal-open');
                
                document.querySelectorAll('.form-control').forEach(el => { el.value = ''; el.classList.remove('error'); });
                
                document.querySelectorAll('.btn-submit').forEach(b => { 
                    b.style.background = ""; b.disabled = false; 
                    if (b.id === 'btn-submit-anlik') b.innerHTML = 'Şimdi Kaydet';
                    else if (b.id === 'btn-submit-duzenli') b.innerHTML = 'Kuralı Oluştur';
                    else if (b.id === 'btn-submit-sabit-onayla') b.innerHTML = 'Onayla ve Kaydet';
                    else if (b.id === 'btn-submit-borc-ode') b.innerHTML = 'Borcu Öde';
                    else if (b.id === 'btn-submit-transfer') b.innerHTML = 'Transfer Yap';
                    else if (b.id === 'btn-submit-borc-guncelle') b.innerHTML = 'Borcu Kaydet/Güncelle';
                    else if (b.id === 'btn-submit-sabit-guncelle') b.innerHTML = 'Kuralı Kalıcı Olarak Güncelle';
                    else if (b.id === 'btn-submit-varlik-guncelle') b.innerHTML = 'Varlığı Güncelle';
                    else if (b.id === 'btn-submit-varlik-ekle') b.innerHTML = 'Varlığı Sisteme Ekle';
                    else if (b.id === 'btn-submit-varlik-sil') b.innerHTML = 'Seçili Varlığı Kalıcı Olarak Sil';
                    else if (b.id === 'btn-submit-yeni-hesap') b.innerHTML = 'Hesabı Oluştur';
                    else if (b.id === 'btn-submit-yeni-kart') b.innerHTML = 'Kartı Sisteme Ekle';
                    else if (b.id === 'btn-submit-kart-borc-ode') b.innerHTML = 'Kart Borcunu Öde';
                    else if (b.id === 'btn-submit-limit-guncelle') b.innerHTML = 'Limiti Güncelle';
                    else if (b.id === 'btn-submit-ekstre-guncelle') b.innerHTML = 'Ekstreyi Güncelle';
                    else if (b.id === 'btn-submit-bakiye-duzelt') b.innerHTML = 'Bakiyeyi Eşitle';
                    else if (b.id === 'btn-submit-kmh-guncelle') b.innerHTML = 'KMH Limitini Güncelle';
                    else if (b.id === 'btn-submit-kart-borc-duzelt') b.innerHTML = 'Borcu Eşitle';
                });
                
                const undoBtn = document.querySelector('.undo-btn');
                if(undoBtn) undoBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:4px;"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg> Son Harcama/Ödemeyi Geri Al`;
                
                btn.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
                btn.style.background = "var(--brand-gradient)";
                if(btn.querySelector('svg')) btn.querySelector('svg').style.transform = "";
            }
        }

        function closeModalOnOutside(e) { if(e.target.id === 'action-modal') toggleModal(); }

        let currentAnlikType = 'Gider';
        let currentDuzenliType = 'Gider';
        let taksitInputType = 'tek';

        function setTaksitInputType(type) {
            vibe();
            taksitInputType = type;
            document.getElementById('btn-taksit-tek').classList.toggle('active', type === 'tek');
            document.getElementById('btn-taksit-toplam').classList.toggle('active', type === 'toplam');
            document.getElementById('lbl-du-tutar-ana').innerText = type === 'tek' ? 'Aylık Taksit Tutarı (₺)' : 'Alışverişin Toplam Tutarı (₺)';
            hesaplaTaksitYardimci();
        }

        function hesaplaTaksitYardimci() {
            const tur = getCustomVal('du-tur');
            const yardimci = document.getElementById('taksit-hesap-yardimci');
            
            if (!tur || !tur.toLowerCase().includes('taksit') || taksitInputType === 'tek') {
                if(yardimci) yardimci.style.display = 'none';
                return;
            }
            
            const tutarRaw = document.getElementById('du-tutar').value;
            const sureRaw = document.getElementById('du-sure').value;
            
            const toplamTutar = parseSaha(tutarRaw);
            const aySayisi = parseInt(sureRaw);
            
            if (toplamTutar > 0 && aySayisi > 0) {
                const aylik = toplamTutar / aySayisi;
                if(yardimci) {
                    yardimci.style.display = 'block';
                    yardimci.innerHTML = `💡 Aylık Ödeme: <span style="font-size:14px; font-weight:800;">${formatTL(aylik)}</span>`;
                }
            } else {
                if(yardimci) {
                    yardimci.style.display = 'block';
                    yardimci.innerText = "💡 Lütfen tutar ve ay süresini girin...";
                }
            }
        }

        function toggleEkInput() {
            const check = document.getElementById('an-ek-check');
            const konteyner = document.getElementById('an-ek-input-konteyner');
            check.checked = !check.checked;
            konteyner.style.display = check.checked ? 'block' : 'none';
            // DÜZELTME: Focus işlemi silindi, böylece klavye sadece sen kutuya dokununca açılacak.
        }

        function setAnlikFilter(type, btn) {
            vibe();
            currentAnlikType = type;
            
            document.querySelectorAll('#anlik-segment .segment-btn').forEach(b => {
                b.classList.remove('active', 'active-gider', 'active-gelir');
            });
            
            if(btn) {
                if(type === 'Gider') btn.classList.add('active-gider');
                else btn.classList.add('active-gelir');
            }
            
            document.getElementById('an-tarih').valueAsDate = new Date();
            
            document.getElementById('an-faiz-grubu').style.display = 'none';
            document.getElementById('an-diger-konteyner').style.display = 'none';
            document.getElementById('an-ek-aciklama-grup').style.display = 'none';
            document.getElementById('an-ek-check').checked = false;
            document.getElementById('an-ek-input-konteyner').style.display = 'none';
            document.getElementById('an-ek-input').value = "";
            
            const kLabel = document.getElementById('an-kalem-label');
            const kKonteyner = document.getElementById('an-kalem-konteyner');
            
            let secenekler = type === 'Gider' ? window.dinamikKategoriler.gider : window.dinamikKategoriler.gelir;
            let optionsHTML = '<option value="" disabled selected>Seçiniz...</option>';
            if (secenekler && secenekler.length > 0) {
                secenekler.forEach(item => optionsHTML += `<option value="${item}">${item}</option>`);
            } else {
                optionsHTML = `<option value="Diğer">Diğer</option>`;
            }
            
            kLabel.innerText = type === 'Gider' ? "Gider Kalemi" : "Gelir Kalemi";
            kKonteyner.innerHTML = `<select id="an-kalem" class="form-control" onchange="checkAnlikKalem()">${optionsHTML}</select>`;
            refreshCustomSelect(document.getElementById('an-kalem'));
            
            const labelEl = document.getElementById('an-yontem-label');
            const selectEl = document.getElementById('an-yontem');
            labelEl.innerText = type === 'Gelir' ? 'Giriş Yapılacak Hesap' : 'Ödeme Hesabı';
            selectEl.innerHTML = type === 'Gelir' ? window.vadesizOptions : window.hesapOptions;
            refreshCustomSelect(selectEl);

                // --- MİMAR DÜZELTMESİ: ÖDEME ŞEKLİ KUTUSUNU PREMİUM YAP ---
    const odSekli = document.getElementById('an-odeme-sekli');
    if(odSekli) {
        odSekli.value = 'tek'; // Her sekme değişiminde 'Tek Hesaptan'a sıfırla
        if(typeof refreshCustomSelect === 'function') refreshCustomSelect(odSekli);
    }    
            
            setTimeout(() => checkAnlikKalem(), 50);
        }

        function checkAnlikKalem() {
            const kalem = getCustomVal('an-kalem');
            const fGrubu = document.getElementById('an-faiz-grubu');
            const dKonteyner = document.getElementById('an-diger-konteyner');
            const ekGrup = document.getElementById('an-ek-aciklama-grup');
            
            fGrubu.style.display = 'none';
            dKonteyner.style.display = 'none';
            ekGrup.style.display = 'none';
            
            if (kalem && kalem.toLowerCase().includes("faiz") && kalem.toLowerCase().includes("banka")) {
                fGrubu.style.display = 'block';
                document.getElementById('an-faiz-detay').innerHTML = window.faizOptions;
                refreshCustomSelect(document.getElementById('an-faiz-detay'));
            } else if (kalem && kalem.toLowerCase() === "diğer") {
                dKonteyner.style.display = 'block';
            } else if (kalem && !kalem.toLowerCase().includes("faiz")) {
                ekGrup.style.display = 'block';
            }
        }

        function setDuzenliFilter(type, btn) {
            vibe(); currentDuzenliType = type;
            
            document.querySelectorAll('#duzenli-segment .segment-btn').forEach(b => {
                b.classList.remove('active', 'active-gider', 'active-gelir');
            });
            
            if(type === 'Gider') btn.classList.add('active-gider');
            else btn.classList.add('active-gelir');
            
            const lblYontem = document.getElementById('du-yontem-label');
            const lblGun = document.getElementById('lbl-du-gun');
            const lblSure = document.getElementById('lbl-du-sure');
            const helperSure = document.getElementById('helper-du-sure');
            const selectYontem = document.getElementById('du-yontem');
            const selectTur = document.getElementById('du-tur');
            
            if(type === 'Gider') {
                lblYontem.innerText = "Ödeme Şekli";
                lblGun.innerText = "Ödeme Günü (1-31)";
                lblSure.innerText = "Ödeme Süresi (Ay)";
                helperSure.innerText = "Süresiz ödeme için tıklayın";
                selectYontem.innerHTML = window.hesapOptions; 
            } else {
                lblYontem.innerText = "Paranın Gireceği Hesap";
                lblGun.innerText = "Gelir Günü (1-31)";
                lblSure.innerText = "Gelir Süresi (Ay)";
                helperSure.innerText = "Süresiz gelir için tıklayın";
                selectYontem.innerHTML = window.vadesizOptions;
            }
            
            // --- YENİ EVRENSEL KATEGORİ MANTIĞI ---
// Seçime göre E-Tablo'dan gelen Gider veya Gelir kategorilerini getirir
let turler = type === 'Gider' ? window.dinamikKategoriler.gider : window.dinamikKategoriler.gelir;
let optionsHTML = '<option value="" disabled selected>Seçiniz...</option>';
if (turler && turler.length > 0) {
    turler.forEach(t => optionsHTML += `<option value="${t}">${t}</option>`);
} else {
    optionsHTML = `<option value="Diğer">Diğer</option>`;
}
selectTur.innerHTML = optionsHTML;

// Etiketi de kullanıcının seçimine göre dinamik olarak değiştir
const lblTur = document.getElementById('lbl-du-tur');
if (lblTur) {
    lblTur.innerText = type === 'Gider' ? "Gider Kategorisi" : "Gelir Kategorisi";
}
            
            refreshCustomSelect(selectYontem);
            refreshCustomSelect(selectTur);
            checkDuzenliTur();
        }

        function checkDuzenliTur() {
            const tur = getCustomVal('du-tur');
            const taksitSecici = document.getElementById('taksit-tip-secici');
            const yardimci = document.getElementById('taksit-hesap-yardimci');
            const tutarLabel = document.getElementById('lbl-du-tutar-ana');
            const suresizBtn = document.getElementById('helper-du-sure');
            
            if(tur && tur.toLowerCase().includes('taksit')) {
                if(taksitSecici) taksitSecici.style.display = 'block';
                if(suresizBtn) suresizBtn.style.display = 'none';
                hesaplaTaksitYardimci();
            } else {
                if(taksitSecici) taksitSecici.style.display = 'none';
                if(yardimci) yardimci.style.display = 'none';
                if(suresizBtn) suresizBtn.style.display = 'inline-block';
                taksitInputType = 'tek';
                if(tutarLabel) tutarLabel.innerText = "Tutar (₺)";
            }
        }

        async function submitAnlik() {
    const anaKalemSecimi = getCustomVal('an-kalem');
    const secilenTarih = document.getElementById('an-tarih').value;
    const tutarStr = document.getElementById('an-tutar').value;
    const tutar = parseSaha(tutarStr);
    
    let err = false;
    if(!anaKalemSecimi || anaKalemSecimi === "Seçiniz...") { markError('an-kalem'); err = true; }
    if(!tutarStr || tutar <= 0) { markError('an-tutar'); err = true; }
    if(!secilenTarih) { markError('an-tarih'); err = true; }
    
    if(err) return;
    
    // MİMAR KORUMASI: Açıklama oluşturma mantığı (Bozulmadı)
    let finalKalem = anaKalemSecimi;
    if(anaKalemSecimi.toLowerCase() === "diğer") {
        const digerInput = document.getElementById('an-kalem-diger').value.trim();
        if(!digerInput) return markError('an-kalem-diger');
        finalKalem = digerInput;
    } else if (anaKalemSecimi && anaKalemSecimi.toLowerCase().includes("faiz") && anaKalemSecimi.toLowerCase().includes("banka")) {
        const faizDetay = getCustomVal('an-faiz-detay');
        if(!faizDetay) return alert("Faiz uygulanan hesabı seçin!");
        finalKalem = faizDetay + " Faizi";
    } else {
        const ekCheck = document.getElementById('an-ek-check');
        const ekInput = document.getElementById('an-ek-input').value.trim();
        if(ekCheck && ekCheck.checked && ekInput) finalKalem = ekInput;
    }
    
    const simdi = new Date();
    const tParca = secilenTarih.split('-');
    const tamTarih = `${tParca[2]}.${tParca[1]}.${tParca[0]} ${String(simdi.getHours()).padStart(2, '0')}:${String(simdi.getMinutes()).padStart(2, '0')}:${String(simdi.getSeconds()).padStart(2, '0')}`;
    
    let payload = {
        action: "yeni_hareket",
        tur: currentAnlikType,
        kategori: anaKalemSecimi,
        kalem: finalKalem,
        taksit: 1,
        tarih: tamTarih
    };

    const sekil = document.getElementById('an-odeme-sekli').value;
    
    if (sekil === 'parcali') {
        const parcalar = [];
        let parcaHata = false;
        document.querySelectorAll('.parca-satiri-anlik').forEach(row => {
            const selectEl = row.querySelector('.an-parca-hesap');
            let hesap = selectEl.value;
            if(!hesap || hesap === "") {
                const spanTxt = row.querySelector('.custom-select-trigger span');
                if(spanTxt) hesap = spanTxt.innerText;
            }
            const pTutarVal = parseSaha(row.querySelector('.an-parca-tutar').value);
            if (!hesap || hesap.includes("Seçiniz") || pTutarVal <= 0) {
                parcaHata = true;
                row.querySelector('.an-parca-tutar').classList.add('error');
            } else {
                parcalar.push({
                    yontem: hesap,
                    tutar: pTutarVal,
                    odeme_turu: window.hesapTurleri[hesap] || "Banka Hesabı"
                });
            }
        });
        if (parcaHata || parcalar.length === 0) return alert("Parçalı ödeme alanlarını kontrol edin!");
        payload.parcalar = parcalar;
    } else {
        const yontem = getCustomVal('an-yontem');
        if(!yontem || yontem === "Seçiniz...") { markError('an-yontem'); return; }
        payload.yontem = yontem;
        payload.tutar = tutar;
        payload.odeme_turu = window.hesapTurleri[yontem] || "Banka Hesabı";
    }
    
    apiIstekAt(payload, 'btn-submit-anlik');
}

        async function submitDuzenli() {
            const tur = getCustomVal('du-tur');
            const kalem = document.getElementById('du-kalem').value;
            const yontem = getCustomVal('du-yontem');
            const tutarInput = document.getElementById('du-tutar').value;
            const gun = document.getElementById('du-gun').value;
            const sure = document.getElementById('du-sure').value;
            
            let finalTutar = parseSaha(tutarInput);
            if (tur && tur.toLowerCase().includes('taksit') && taksitInputType === 'toplam') {
                const tNum = parseSaha(tutarInput);
                const sNum = parseInt(sure);
                if (tNum > 0 && sNum > 0 && !isNaN(sNum)) {
                    finalTutar = parseFloat((tNum / sNum).toFixed(2));
                } else {
                    return alert("Toplam tutarı bölebilmemiz için lütfen 'Ödeme Süresi (Ay)' kısmına geçerli bir taksit sayısı girin!");
                }
            }
            
            if(!kalem || finalTutar <= 0 || !gun) return alert("Eksik alanları doldurun!");
            if(!sure) return alert("Lütfen süre belirtin!");
            if(!yontem || yontem.includes("Seçin")) { markError('du-yontem'); return alert("Lütfen ödeme şeklini / hesabı seçin!"); }
            
            const odTuru = window.hesapTurleri[yontem] || "Banka Hesabı";
            
            apiIstekAt({
                action: "yeni_sabit",
                yon: currentDuzenliType,
                tur: tur,
                kalem: kalem,
                yontem: yontem,
                tutar: finalTutar,
                odeme_gunu: gun,
                kalan_ay: sure,
                odeme_turu: odTuru
            }, 'btn-submit-duzenli');
        }

        let currentSabitYonetFilter = 'Gider';
        function setSabitFilter(yon, btn) {
            vibe(); currentSabitYonetFilter = yon;
            const btns = btn.parentElement.querySelectorAll('.segment-btn');
            btns.forEach(b => b.classList.remove('active-gider', 'active-gelir', 'active'));
            btn.classList.add(yon === 'Gider' ? 'active-gider' : 'active-gelir');
            renderSabitSelect();
        }

        function renderSabitSelect() {
            const sel = document.getElementById('sg-kural');
            const formAlani = document.getElementById('sabit-guncelle-form-alani');
            if (!sel || !window.sabitKurallarList) return;
            
            const filtrelenmis = window.sabitKurallarList.filter(k => {
                let kYon = k.yon ? k.yon.toString().trim() : "Gider";
                if (currentSabitYonetFilter === 'Gider') return kYon === 'Gider' || kYon === 'Borç Ödemesi';
                return kYon === currentSabitYonetFilter;
            });
            let optionsHTML = `<option value="">-- Kayıt Seçin --</option>`;
            
            filtrelenmis.forEach(k => {
            // Evrensel Kural (Boşluk/Hata Korumalı): Kategori varsa Açıklama ile birleştir
let temizTur = (k.tur || "").toString().trim();
let temizKalem = (k.kalem || "").toString().trim();
let gorunenAd = (temizTur && temizTur !== "-") ? (temizKalem ? `${temizTur} - ${temizKalem}` : temizTur) : (temizKalem || "İsimsiz Kayıt");
            if(k.durum !== "Aktif") gorunenAd += " [İPTAL/BİTTİ]";
                optionsHTML += `<option value="${k.satir}" data-yon="${k.yon}" data-tur="${k.tur}" data-tutar="${k.tutar}" data-yontem="${k.yontem}" data-gun="${k.gun}" data-sure="${k.kalan_ay}" data-durum="${k.durum}">${gorunenAd} - ₺${k.tutar}</option>`;
            });
            
            sel.innerHTML = optionsHTML;
            if(formAlani) formAlani.style.display = 'none';
            refreshCustomSelect(sel);
        }

        function toggleVarlikTab(tab) {
    vibe();
    const btnGuncelle = document.getElementById('btn-tab-varlik-guncelle');
    const btnEkleSil = document.getElementById('btn-tab-varlik-ekle-sil');

    if(tab === 'guncelle') {
        btnGuncelle.className = 'segment-btn active';
        btnEkleSil.className = 'segment-btn';
        document.getElementById('tab-varlik-guncelle').style.display = 'block';
        document.getElementById('tab-varlik-ekle-sil').style.display = 'none';
    } else {
        btnGuncelle.className = 'segment-btn';
        btnEkleSil.className = 'segment-btn active';
        document.getElementById('tab-varlik-guncelle').style.display = 'none';
        document.getElementById('tab-varlik-ekle-sil').style.display = 'block';
        
        const katSelect = document.getElementById('ve-kategori');
        if(katSelect && katSelect.options.length === 0) {
            let kHtml = '<option value="" disabled selected>Seçiniz...</option>';
            if(window.dinamikKategoriler && window.dinamikKategoriler.varlikKategorileri) {
                window.dinamikKategoriler.varlikKategorileri.forEach(k => kHtml += `<option value="${k}">${k}</option>`);
            } else {
                kHtml = `<option value="Genel">Genel</option>`;
            }
            katSelect.innerHTML = kHtml;
            refreshCustomSelect(katSelect);
        }
    }
}

function submitVarlikGuncelle() {
    let isim = getCustomVal('vg-secim');
    const deger = document.getElementById('vg-deger').value;
    let err = false;
    if(!isim || isim.includes("Seçin")) { markError('vg-secim'); err = true; }
    if(deger === "") { markError('vg-deger'); err = true; }
    if(err) return;
    apiIstekAt({ action: "varlik_guncelle", varlik_adi: isim, deger: deger }, 'btn-submit-varlik-guncelle');
}

function submitVarlikEkle() {
    const isim = document.getElementById('ve-isim').value.trim();
    const kategori = getCustomVal('ve-kategori');
    const maliyet = document.getElementById('ve-maliyet').value;
    const guncel = document.getElementById('ve-guncel').value;
    const tarih = document.getElementById('ve-tarih').value;

    let err = false;
    if(!isim) { markError('ve-isim'); err = true; }
    if(maliyet === "") { markError('ve-maliyet'); err = true; }
    if(guncel === "") { markError('ve-guncel'); err = true; }
    if(!tarih) { markError('ve-tarih'); err = true; }
    if(err) return;

    const simdi = new Date();
    const saatDak = String(simdi.getHours()).padStart(2, '0') + ':' + String(simdi.getMinutes()).padStart(2, '0');
    const tParca = tarih.split('-');
    const tamTarihLog = `${tParca[2]}.${tParca[1]}.${tParca[0]} ${saatDak}`;

    apiIstekAt({ 
        action: "varlik_ekle", 
        varlik_adi: isim, 
        kategori: kategori,
        maliyet: maliyet, 
        deger: guncel, 
        tarih: tamTarihLog 
    }, 'btn-submit-varlik-ekle');
}

function submitVarlikSil() {
    const isim = getCustomVal('vs-secim');
    if(!isim || isim.includes("Seçin")) { markError('vs-secim'); return; }

    if(!confirm(`"${isim}" adlı varlığı sistemden (log dosyasından ve pwadan) kalıcı olarak silmek istediğinize emin misiniz?`)) return;

    apiIstekAt({ action: "varlik_sil", varlik_adi: isim }, 'btn-submit-varlik-sil');
}

        async function openSectionLive(ev, sectionId, title) {
            const btn = ev.currentTarget; const orig = btn.innerHTML;
            btn.innerHTML = `<div class="premium-loader"><span></span><span></span><span></span></div>`; vibe();
            await verileriCek();
            btn.innerHTML = orig; showSection(sectionId, title);
        }

        function showSection(id, title) {
            vibe();
            document.querySelectorAll('.form-section').forEach(el => el.classList.remove('active'));
            document.getElementById(id).classList.add('active');
            setText('modal-title', title);
            document.querySelectorAll('.form-control').forEach(el => { el.value = ''; el.classList.remove('error'); });
            
                        if(id === 'section-anlik') {
                // MİMAR DOKUNUŞU: Formu tertemiz yap
                resetAnlikForm();

                if(document.querySelectorAll('#anlik-segment .segment-btn').length > 0) {
                    document.querySelectorAll('#anlik-segment .segment-btn')[0].classList.add('active');
                    document.querySelectorAll('#anlik-segment .segment-btn')[1].classList.remove('active');
                }
                // Filtreyi Gider olarak başlat (Bu işlem kategorileri doldurur)
                setAnlikFilter('Gider', document.querySelectorAll('#anlik-segment .segment-btn')[0]);
            }
            if(id === 'section-duzenli') {
                if(document.querySelectorAll('#duzenli-segment .segment-btn').length > 0) {
                    document.querySelectorAll('#duzenli-segment .segment-btn')[0].classList.add('active');
                    document.querySelectorAll('#duzenli-segment .segment-btn')[1].classList.remove('active');
                }
                setDuzenliFilter('Gider', document.querySelectorAll('#duzenli-segment .segment-btn')[0]);
            }
            if(id === 'section-transfer') {
                document.getElementById('t-tarih').valueAsDate = new Date();
                document.getElementById('t-cikis').value = ""; document.getElementById('t-giris').value = "";
                updateTransferOptions();
            }
            if(id === 'section-kart-borc-ode') {
                document.getElementById('kbo-tarih').valueAsDate = new Date();
                document.getElementById('kbo-odeme-sekli').value = 'tek';
                toggleParcaliKartBorcOdeme(); refreshCustomSelect(document.getElementById('kbo-odeme-sekli'));
            }
            if(id === 'kredi-islemleri-screen') {
                document.getElementById('kredi-secim').value = ''; 
                document.getElementById('kredi-tarih').valueAsDate = new Date();
                document.getElementById('kredi-yeni-tarih').valueAsDate = new Date();
                document.getElementById('kredi-odeme-sekli').value = 'tek'; toggleParcaliKrediOdeme(); 
                refreshCustomSelect(document.getElementById('kredi-odeme-sekli')); refreshCustomSelect(document.getElementById('kredi-secim'));
                toggleKrediTab('ode');
            }
            if(id === 'ozel-borc-islemleri-screen') {
                document.getElementById('ozel-secim').value = ''; 
                document.getElementById('ozel-tarih').valueAsDate = new Date();
                document.getElementById('ozel-yeni-tarih').valueAsDate = new Date();
                document.getElementById('ozel-odeme-sekli').value = 'tek'; toggleParcaliOzelOdeme(); 
                refreshCustomSelect(document.getElementById('ozel-odeme-sekli')); refreshCustomSelect(document.getElementById('ozel-secim'));
                toggleOzelTab('ode');
            }
            if(id === 'section-varlik-guncelle') {
        document.getElementById('vg-secim').value = ''; 
        document.getElementById('vs-secim').value = '';
        refreshCustomSelect(document.getElementById('vg-secim'));
        refreshCustomSelect(document.getElementById('vs-secim'));
        toggleVarlikTab('guncelle');
    }
            if(id === 'section-kart-limit-guncelle') {
  document.getElementById('kl-mevcut-limit-grup').style.display = 'none';
  document.getElementById('kl-yeni-limit').value = '';
}
                if(id === 'section-hesap-islemleri') {
                document.getElementById('hi-hesap-secim').value = '';
                document.getElementById('hi-mevcut-bilgi').style.display = 'none';
                document.getElementById('hi-yeni-bakiye').value = '';
                document.getElementById('hi-yeni-kmh').value = '';
                // Siyah premium select stilini sıfırla
                if(typeof refreshCustomSelect === 'function') {
                    refreshCustomSelect(document.getElementById('hi-hesap-secim'));
                }
                // Sekmeyi varsayılan olarak "Bakiye" kısmına al
                toggleHesapIslemTab('bakiye');
            }

                                if(id === 'section-kart-borc-duzelt') {
                    document.getElementById('kbd-kart-secim').value = '';
                    document.getElementById('kbd-mevcut-bilgi').style.display = 'none';
                    document.getElementById('kbd-yeni-borc').value = '';
                    if(typeof refreshCustomSelect === 'function') refreshCustomSelect(document.getElementById('kbd-kart-secim'));
                }
        }

        function fillInput(id, text) { vibe(); document.getElementById(id).value = text; }

        function swapTransfer() {
            vibe(); const cikisEl = document.getElementById('t-cikis'); const girisEl = document.getElementById('t-giris');
            const eskiCikis = cikisEl.value; const eskiGiris = girisEl.value;
            if (!eskiCikis && !eskiGiris) return;
            const yeniCikis = eskiGiris; const yeniGiris = eskiCikis;
            
            const tempDiv = document.createElement('div'); tempDiv.innerHTML = window.vadesizOptions;
            const tumSecenekler = Array.from(tempDiv.querySelectorAll('option')).filter(o => o.value !== "");
            
            let yeniCikisHTML = `<option value="">Seçiniz...</option>`;
            tumSecenekler.forEach(opt => { if (opt.value !== yeniGiris) { yeniCikisHTML += `<option value="${opt.value}" ${opt.value === yeniCikis ? 'selected' : ''}>${opt.text}</option>`; } });
            cikisEl.innerHTML = yeniCikisHTML;
            
            let yeniGirisHTML = `<option value="">Seçiniz...</option>`;
            tumSecenekler.forEach(opt => { if (opt.value !== yeniCikis) { yeniGirisHTML += `<option value="${opt.value}" ${opt.value === yeniGiris ? 'selected' : ''}>${opt.text}</option>`; } });
            girisEl.innerHTML = yeniGirisHTML;
            
            refreshCustomSelect(cikisEl); refreshCustomSelect(girisEl);
        }

        function markError(id) { const el = document.getElementById(id); if(el) { el.classList.add('error'); setTimeout(() => el.classList.remove('error'), 400); } }

        function getCustomVal(id) { 
            const el = document.getElementById(id); if(!el) return "";
            let val = el.value; 
            if (!val || val.trim() === "") { 
                const span = el.parentElement.querySelector('.custom-select-trigger span'); 
                if (span && span.innerText !== "Seçiniz...") { 
                    let rawText = span.innerText.trim(); 
                    if(rawText.includes(" (KMH)")) rawText = rawText.replace(" (KMH)", "").trim(); 
                    if(rawText.includes(" [İPTAL/BİTTİ]")) rawText = rawText.replace(" [İPTAL/BİTTİ]", "").trim(); 
                    return rawText; 
                } 
            } 
            return val.trim(); 
        }

                        async function apiIstekAt(payload, buttonId) {
        if(document.activeElement) document.activeElement.blur();

        const btn = document.getElementById(buttonId); 
        const originalText = btn.innerHTML;
        
        btn.innerHTML = `<div class="premium-loader"><span></span><span></span><span></span></div>`; 
        btn.disabled = true; 
        vibe();

        try {
            const res = await fetch(API_URL, { 
                method: 'POST', 
                headers: { 'Content-Type': 'text/plain' }, 
                body: JSON.stringify(payload) 
            });

            const result = await res.json(); 

            if (result.status === "success") {
            vibe(); 
            
            // --- GERİ AL LİSTESİNDEKİ O GÖRÜNTÜYÜ DÜZELTEN KISIM ---
            if (payload.action === 'geri_al') {
                // Yazıyı siliyoruz, arka planı şeffaf yapıyoruz, sadece temiz bir yeşil TİK koyuyoruz
                btn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--emerald)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                btn.style.background = "transparent"; 
                btn.style.boxShadow = "none";
                btn.style.border = "none";
            } 
            // --- DİĞER TÜM ANA BUTONLAR (KAYDET, GÜNCELLE VS.) İÇİN STANDART HAL ---
            else {
                btn.innerHTML = `Başarılı ✓`; 
                btn.style.background = "var(--emerald)";
                
                // Form gönderildiğinde ekranın sağ altındaki artı butonunu da yeşil yap
                const fabBtn = document.getElementById('fab-btn');
                if (fabBtn) {
                    fabBtn.classList.remove('open');
                    fabBtn.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                    fabBtn.style.background = "var(--emerald)";
                }
            }
            
            // Verileri yenile
            setTimeout(async () => {
                await verileriCek();
            }, 1000);

        } else {
                alert("İşlem başarısız: " + result.message);
                btn.innerHTML = originalText; 
                btn.disabled = false;
            }

        } catch (error) {
            alert("Bağlantı veya Sunucu Hatası: İşlem kaydedilemedi.");
            btn.innerHTML = originalText; 
            btn.disabled = false;
        }
    }

                                async function loadSabitlerAndShow(sectionId, selectId, title) {
            const ev = event.currentTarget; const orig = ev.innerHTML;
            ev.innerHTML = `<div class="premium-loader"><span></span><span></span><span></span></div>`; vibe();
            try {
                const res = await fetch(API_URL, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'text/plain' }, 
                    body: JSON.stringify({ action: "sabitleri_getir" }) 
                });
                const result = await res.json();
                
                if(result.status === "success") {
                    if(sectionId === 'section-sabit-onayla') {
                        const sSimdi = new Date(); 
                        window.sabitDataRaw = result.data.filter(k => {
                            if (k.durum !== 'Aktif') return false; 
                            let turu = k.tur ? k.tur.toString().trim().toLowerCase() : "";
                            if (turu.includes('taksit') || turu.includes('abonelik') || turu.includes('yatırım') || turu.includes('otomatik')) return false;
                            
                            if (k.son_islem && k.son_islem !== "" && k.son_islem !== "-") {
                                let sTarih = new Date(k.son_islem); // ISO formatı sayesinde tek satır!
                                if (!isNaN(sTarih.getTime())) {
                                    let farkGun = (sSimdi.getTime() - sTarih.getTime()) / (1000 * 3600 * 24);
                                    if (farkGun < 20) return false; // 20 günden yakınsa listeden çıkar
                                }
                            }
                            return true;
                        });
                        
                        showSection(sectionId, title);
                        document.getElementById('so-odeme-sekli').value = 'tek';
                        document.getElementById('so-kalici-check').checked = false;
                        toggleParcaliOdeme(); refreshCustomSelect(document.getElementById('so-odeme-sekli'));
                        if(document.querySelectorAll('#so-main-segment .segment-btn').length > 0) {
                            setSabitMainFilter('Gider', document.querySelectorAll('#so-main-segment .segment-btn')[0]);
                        }
                    } else {
                        window.sabitKurallarList = result.data || [];
                        showSection(sectionId, title);
                        if(document.querySelectorAll('#sabit-guncelle-segment .segment-btn').length > 0) {
                            setSabitFilter('Gider', document.querySelectorAll('#sabit-guncelle-segment .segment-btn')[0]);
                        }
                    }
                }
            } catch(e) { alert("Sistem Hatası: " + e.message); }
            if (ev) ev.innerHTML = orig;
        }

        // Yardımcı fonksiyonun (Aynı kaldı, dokunma)
        let currentSabitMainType = 'Gider';
        function setSabitMainFilter(yon, btnElement) {
            vibe(); currentSabitMainType = yon;
            if (btnElement) {
                document.querySelectorAll('#so-main-segment .segment-btn').forEach(btn => btn.classList.remove('active', 'active-gider', 'active-gelir'));
                btnElement.classList.add(yon === 'Gider' ? 'active-gider' : 'active-gelir');
            }
            renderSabitKategori();
        }

        function renderSabitKategori() {
            const katSelect = document.getElementById('so-kategori');
            let html = `<option value="Hepsi">Tüm Kategoriler</option>`;
            
            let uniqueTurler = [...new Set(window.sabitDataRaw.filter(k => {
                if (currentSabitMainType === 'Gider') return k.yon === 'Gider' || k.yon === 'Borç Ödemesi';
                return k.yon === currentSabitMainType;
            }).map(k => k.tur))];
            uniqueTurler.forEach(tur => {
                if(tur) html += `<option value="${tur}">${tur}</option>`;
            });
            
            katSelect.innerHTML = html; refreshCustomSelect(katSelect); onKategoriChange();
        }

        function onKategoriChange() { applySabitFilters(); }

        function applySabitFilters() {
            const sel = document.getElementById('so-kural');
            const katSelect = document.getElementById('so-kategori');
            if (!sel || !katSelect) return;
            
            const secilenKategori = getCustomVal('so-kategori') || "Hepsi";
            sel.innerHTML = "";
            
            let filteredData = window.sabitDataRaw.filter(k => {
                let kYon = k.yon ? k.yon.toString().trim() : "Gider";
                let kTur = k.tur ? k.tur.toString().trim() : "";
                
                if (currentSabitMainType === 'Gider') {
                    if (kYon !== 'Gider' && kYon !== 'Borç Ödemesi') return false;
                } else {
                    if (kYon !== currentSabitMainType) return false;
                }
                if (secilenKategori !== 'Hepsi') { if (kTur !== secilenKategori) return false; }
                return true;
            });
            
            filteredData.sort((a, b) => {
                let gunA = parseInt(a.gun) || 31; let gunB = parseInt(b.gun) || 31;
                return gunA - gunB;
            });
            
            filteredData.forEach(k => {
            let sureMetni = k.kalan_ay === "Süresiz" ? "∞" : `${k.kalan_ay} Ay`;
            let ek = turkceEkBul(k.gun);
            // Evrensel Kural (Boşluk/Hata Korumalı): Kategori varsa Açıklama ile birleştir
let temizTur = (k.tur || "").toString().trim();
let temizKalem = (k.kalem || "").toString().trim();
let gorunenAd = (temizTur && temizTur !== "-") ? (temizKalem ? `${temizTur} - ${temizKalem}` : temizTur) : (temizKalem || "İsimsiz Kayıt");
            // Rakamı PWA'ya uygun hale getiriyoruz (Örn: 532.18 -> 532,18)
            let gorselTutar = Number(k.tutar).toLocaleString('tr-TR', {minimumFractionDigits: 2});
            let label = `Ayın ${k.gun}${ek} - ${gorunenAd} / ₺${gorselTutar} (${sureMetni})`;
                if(k.durum !== "Aktif") label += " [İPTAL/BİTTİ]";
                sel.innerHTML += `<option value="${k.satir}" data-yon="${k.yon}" data-tur="${k.tur}" data-tutar="${k.tutar}" data-yontem="${k.yontem}" data-gun="${k.gun}" data-sure="${k.kalan_ay}" data-durum="${k.durum}">${label}</option>`;
            });
            
            if (filteredData.length === 0) sel.innerHTML = `<option value="">Bu kategoride bekleyen işlem yok</option>`;
            
            const yontemSelect = document.getElementById('so-yontem');
            if (yontemSelect) {
                yontemSelect.innerHTML = (currentSabitMainType === 'Gelir') ? window.vadesizOptions : window.hesapOptions;
                refreshCustomSelect(yontemSelect);
            }
            
            const lblTutar = document.getElementById('lbl-so-tutar');
            if(lblTutar) lblTutar.innerText = currentSabitMainType === 'Gelir' ? 'Net Gelir Tutarı (₺)' : 'Bu Ay Gerçekleşen Net Tutar (₺)';
            
            refreshCustomSelect(sel); onKuralChange();
        }

                        function onKuralChange() {
            const select = document.getElementById('so-kural');
            const opt = select.options[select.selectedIndex];
            if(!opt || !opt.value) {
                document.getElementById('so-referans-tutar').innerHTML = "₺0,00";
                document.getElementById('so-guncel-tutar').value = "";
                return;
            }
            
            const dataTutarRaw = opt.getAttribute('data-tutar');
            const yon = (opt.getAttribute('data-yon') || "").trim();
            
            document.getElementById('so-referans-tutar').innerHTML = formatTL(parseSaha(dataTutarRaw));
            
            // --- NİHAİ ÇÖZÜM: İmleç hatasına takılmadan doğrudan TR formatında basıyoruz ---
            const tVal = parseFloat(dataTutarRaw) || 0;
            document.getElementById('so-guncel-tutar').value = tVal.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            
            const lblYontem = document.getElementById('lbl-so-yontem');
            if(lblYontem) lblYontem.innerText = yon === 'Gelir' ? 'Paranın Gireceği Hesap' : 'Paranın Çıktığı Hesap';
            
            hesaplaKalanParcali();
        }

        function toggleParcaliOdeme() {
            const sekil = getCustomVal('so-odeme-sekli');
            if(sekil === 'parcali') {
                document.getElementById('so-tek-hesap-alani').style.display = 'none';
                document.getElementById('so-parcali-hesap-alani').style.display = 'block';
                document.getElementById('so-parcalar-container').innerHTML = '';
                addParca(); addParca(); hesaplaKalanParcali();
            } else {
                document.getElementById('so-tek-hesap-alani').style.display = 'block';
                document.getElementById('so-parcali-hesap-alani').style.display = 'none';
            }
        }

        function addParca() {
            const container = document.getElementById('so-parcalar-container');
            if(container.querySelectorAll('.parca-satiri').length >= 5) { alert("En fazla 5 parçaya bölebilirsiniz."); return; }
            
            const row = document.createElement('div'); row.className = 'parca-satiri';
            row.style.cssText = "display: grid; grid-template-columns: 1.5fr 1fr auto; gap: 8px; margin-bottom: 10px; align-items: start;";
            
            const yontemSelect = document.getElementById('so-yontem');
            const dinamikSecenekler = yontemSelect ? yontemSelect.innerHTML : `<option value="">Hesap Seçin</option>`;
            
            // MİMAR DOKUNUŞU: Benzersiz Kimlik
            const uniqueId = 'parca-so-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
            
            row.innerHTML = `
                <select id="${uniqueId}" class="form-control parca-hesap" style="padding: 10px; font-size: 13px;">
                    ${dinamikSecenekler}
                </select>
                <input type="text" inputmode="decimal" class="form-control parca-tutar" placeholder="Tutar" oninput="tutarFormatla(this); hesaplaKalanParcali()" style="padding: 10px; font-size: 14px;">
                <button onclick="this.parentElement.remove(); hesaplaKalanParcali();" style="background: rgba(244, 63, 94, 0.15); border: none; color: var(--rose); width: 38px; height: 38px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
            `;
            // Artık kendi kimliğiyle çiziliyor
            container.appendChild(row); refreshCustomSelect(document.getElementById(uniqueId));
        }

        function hesaplaKalanParcali() {
            const hedefTutar = parseSaha(document.getElementById('so-guncel-tutar').value) || 0;
            const sekil = getCustomVal('so-odeme-sekli');
            if(sekil !== 'parcali') return;
            
            let girilenToplam = 0;
            document.querySelectorAll('.parca-tutar').forEach(inp => girilenToplam += parseSaha(inp.value) || 0);
            
            const kalan = hedefTutar - girilenToplam;
            document.getElementById('so-hedef-tutar').innerText = "₺" + hedefTutar.toLocaleString('tr-TR', {minimumFractionDigits:2});
            
            const kalanEl = document.getElementById('so-kalan-tutar');
            if(kalan === 0) { kalanEl.style.color = "var(--emerald)"; kalanEl.innerText = "₺0,00"; }
            else if (kalan < 0) { kalanEl.style.color = "var(--rose)"; kalanEl.innerText = "Fazla: ₺" + Math.abs(kalan).toLocaleString('tr-TR', {minimumFractionDigits:2}); }
            else { kalanEl.style.color = "var(--amber)"; kalanEl.innerText = "₺" + kalan.toLocaleString('tr-TR', {minimumFractionDigits:2}); }
        }

        function submitPasGec() {
            const kuralSatir = getCustomVal('so-kural');
            if(!kuralSatir) return markError('so-kural');
            if(confirm("Bu işlemi bu ay için pas geçmek (ödenmiş sayıp gelecek aya devretmek) istediğinize emin misiniz?")) {
                apiIstekAt({ action: "sabit_onayla", satir: kuralSatir, odeme_sekli: "parcali", parcalar: [{ yontem: "Sistem", tutar: 0 }] }, 'btn-submit-sabit-onayla');
            }
        }

        function submitSabitOnayla() {
            const kuralSatir = getCustomVal('so-kural');
            const sekil = getCustomVal('so-odeme-sekli');
            const guncelTutarStr = document.getElementById('so-guncel-tutar').value;
            const isKalici = document.getElementById('so-kalici-check').checked;
            
            if(!kuralSatir) { markError('so-kural'); return; }
            if(!guncelTutarStr) { markError('so-guncel-tutar'); return; }
            
            let payload = { action: "sabit_onayla", satir: kuralSatir, odeme_sekli: "parcali", kalici_guncelle: isKalici, yeni_tutar: parseSaha(guncelTutarStr) };
            
            if(sekil === 'parcali') {
                const parcalar = []; let hataVar = false;
                document.querySelectorAll('.parca-satiri').forEach(row => {
                    let yontem = row.querySelector('.parca-hesap').value;
                    if(!yontem || yontem.trim() === "") {
                        const spanTxt = row.querySelector('.custom-select-trigger span');
                        if(spanTxt) yontem = spanTxt.innerText;
                    }
                    const tutarStr = row.querySelector('.parca-tutar').value;
                    const tutarVal = parseSaha(tutarStr);
                    
                    if(!tutarStr || tutarVal <= 0) { row.querySelector('.parca-tutar').classList.add('error'); hataVar = true; }
                    else { parcalar.push({ yontem: yontem, tutar: tutarVal }); }
                });
                if(hataVar) return;
                if(parcalar.length === 0) return alert("Lütfen en az bir ödeme tutarı girin.");
                payload.parcalar = parcalar;
            } else {
                let tekYontem = getCustomVal('so-yontem');
                if(!tekYontem || tekYontem.includes("Seçin")) return markError('so-yontem');
                payload.parcalar = [{ yontem: tekYontem, tutar: parseSaha(guncelTutarStr) }];
            }
            
            apiIstekAt(payload, 'btn-submit-sabit-onayla');
        }

        function toggleParcaliKartBorcOdeme() {
            const sekil = getCustomVal('kbo-odeme-sekli');
            if(sekil === 'parcali') {
                document.getElementById('kbo-tek-hesap-alani').style.display = 'none';
                document.getElementById('kbo-parcali-hesap-alani').style.display = 'block';
                document.getElementById('kbo-parcalar-container').innerHTML = '';
                addParcaKartBorc(); addParcaKartBorc(); hesaplaKalanParcaliKartBorc();
            } else {
                document.getElementById('kbo-tek-hesap-alani').style.display = 'block';
                document.getElementById('kbo-parcali-hesap-alani').style.display = 'none';
            }
        }

        function addParcaKartBorc() {
            const container = document.getElementById('kbo-parcalar-container');
            if(container.querySelectorAll('.parca-satiri-kartborc').length >= 5) { alert("En fazla 5 parçaya bölebilirsiniz."); return; }
            const row = document.createElement('div'); row.className = 'parca-satiri-kartborc';
            row.style.cssText = "display: grid; grid-template-columns: 1.5fr 1fr auto; gap: 8px; margin-bottom: 10px; align-items: start;";
            
            const yontemSelect = document.getElementById('kbo-yontem');
            const dinamikSecenekler = yontemSelect ? yontemSelect.innerHTML : `<option value="">Hesap Seçin</option>`;
            
            const uniqueId = 'parca-kbo-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
            
            row.innerHTML = `
                <select id="${uniqueId}" class="form-control parca-hesap-kartborc" style="padding: 10px; font-size: 13px;">${dinamikSecenekler}</select>
                <input type="text" inputmode="decimal" class="form-control parca-tutar-kartborc" placeholder="Tutar" oninput="tutarFormatla(this); hesaplaKalanParcaliKartBorc()" style="padding: 10px; font-size: 14px;">
                <button onclick="this.parentElement.remove(); hesaplaKalanParcaliKartBorc();" style="background: rgba(244, 63, 94, 0.15); border: none; color: var(--rose); width: 38px; height: 38px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
            `;
            container.appendChild(row); refreshCustomSelect(document.getElementById(uniqueId));
        }

        function hesaplaKalanParcaliKartBorc() {
            const hedefTutar = parseSaha(document.getElementById('kbo-tutar').value) || 0;
            let girilenToplam = 0; document.querySelectorAll('.parca-tutar-kartborc').forEach(inp => girilenToplam += parseSaha(inp.value) || 0);
            const kalan = hedefTutar - girilenToplam;
            document.getElementById('kbo-hedef-tutar').innerText = "₺" + hedefTutar.toLocaleString('tr-TR', {minimumFractionDigits:2});
            
            const kalanEl = document.getElementById('kbo-kalan-tutar');
            if(kalan === 0) { kalanEl.style.color = "var(--emerald)"; kalanEl.innerText = "₺0,00"; }
            else if (kalan < 0) { kalanEl.style.color = "var(--rose)"; kalanEl.innerText = "Fazla: ₺" + Math.abs(kalan).toLocaleString('tr-TR', {minimumFractionDigits:2}); }
            else { kalanEl.style.color = "var(--amber)"; kalanEl.innerText = "₺" + kalan.toLocaleString('tr-TR', {minimumFractionDigits:2}); }
        }

        function submitKartBorcuOde() {
            const kartIsmi = getCustomVal('kbo-secim');
            const tutar = document.getElementById('kbo-tutar').value;
            const sekil = getCustomVal('kbo-odeme-sekli');
            
            let err = false;
            if(!kartIsmi || kartIsmi === "-- Kart Seçin --" || kartIsmi === "Seçiniz...") { markError('kbo-secim'); err = true; }
            if(!tutar) { markError('kbo-tutar'); err = true; }
            
            const secilenTarih = document.getElementById('kbo-tarih').value;
            if(!secilenTarih) { markError('kbo-tarih'); err = true; }
            if(err) return;
            
            const simdi = new Date(); const tParca = secilenTarih.split('-');
            const tamTarihLog = `${tParca[2]}.${tParca[1]}.${tParca[0]} ${String(simdi.getHours()).padStart(2,'0')}:${String(simdi.getMinutes()).padStart(2,'0')}`;

            let payload = { action: "kart_borcu_ode", kart_adi: kartIsmi, tutar: tutar, tarih: tamTarihLog, odeme_sekli: sekil };
            
            if(sekil === 'parcali') {
                const parcalar = []; let hataVar = false;
                document.querySelectorAll('.parca-satiri-kartborc').forEach(row => {
                    let yontem = row.querySelector('.parca-hesap-kartborc').value;
                    if(!yontem || yontem.trim() === "") {
                        const spanTxt = row.querySelector('.custom-select-trigger span');
                        if(spanTxt) yontem = spanTxt.innerText;
                    }
                    const pTutarStr = row.querySelector('.parca-tutar-kartborc').value;
                    const pTutarVal = parseSaha(pTutarStr);
                    if(!pTutarStr || pTutarVal <= 0) { row.querySelector('.parca-tutar-kartborc').classList.add('error'); hataVar = true; }
                    else { parcalar.push({ yontem: yontem, tutar: pTutarVal }); }
                });
                if(hataVar) return;
                if(parcalar.length === 0) return alert("Lütfen en az bir ödeme tutarı girin.");
                payload.parcalar = parcalar;
            } else {
                let tekYontem = getCustomVal('kbo-yontem');
                if(!tekYontem || tekYontem.includes("Seçin")) return markError('kbo-yontem');
                payload.yontem = tekYontem;
            }
            apiIstekAt(payload, 'btn-submit-kart-borc-ode');
        }
        
// ==========================================
        // YENİ: KREDİ VE ÖZEL BORÇ YÖNETİM MOTORU
        // ==========================================
        function toggleKrediTab(tab) {
            vibe();
            const btnOde = document.getElementById('btn-tab-kredi-ode');
            const btnEkle = document.getElementById('btn-tab-kredi-ekle');
            if(tab === 'ode') {
                btnOde.className = 'segment-btn active-borc-ode'; 
                btnEkle.className = 'segment-btn';
                document.getElementById('tab-kredi-ode').style.display = 'block'; 
                document.getElementById('tab-kredi-ekle').style.display = 'none';
            } else {
                btnOde.className = 'segment-btn'; 
                btnEkle.className = 'segment-btn active-gelir';
                document.getElementById('tab-kredi-ode').style.display = 'none'; 
                document.getElementById('tab-kredi-ekle').style.display = 'block';
            }
        }

        function toggleOzelTab(tab) {
            vibe();
            const btnOde = document.getElementById('btn-tab-ozel-ode');
            const btnGuncelle = document.getElementById('btn-tab-ozel-guncelle');
            const btnEkle = document.getElementById('btn-tab-ozel-ekle');
            
            document.getElementById('tab-ozel-ode').style.display = 'none';
            document.getElementById('tab-ozel-guncelle').style.display = 'none';
            document.getElementById('tab-ozel-ekle').style.display = 'none';
            
            if(tab === 'ode') {
                btnOde.className = 'segment-btn active-borc-ode'; btnGuncelle.className = 'segment-btn'; btnEkle.className = 'segment-btn';
                document.getElementById('tab-ozel-ode').style.display = 'block';
            } else if(tab === 'guncelle') {
                btnOde.className = 'segment-btn'; btnGuncelle.className = 'segment-btn active-borc-guncelle'; btnEkle.className = 'segment-btn';
                document.getElementById('tab-ozel-guncelle').style.display = 'block';
            } else {
                btnOde.className = 'segment-btn'; btnGuncelle.className = 'segment-btn'; btnEkle.className = 'segment-btn active-gelir';
                document.getElementById('tab-ozel-ekle').style.display = 'block';
            }
        }

        function toggleParcaliKrediOdeme() {
            const sekil = getCustomVal('kredi-odeme-sekli');
            if(sekil === 'parcali') {
                document.getElementById('kredi-tek-hesap-alani').style.display = 'none';
                document.getElementById('kredi-parcali-hesap-alani').style.display = 'block';
                document.getElementById('kredi-parcalar-container').innerHTML = '';
                addParcaKredi(); addParcaKredi(); hesaplaKalanParcaliKredi();
            } else {
                document.getElementById('kredi-tek-hesap-alani').style.display = 'block';
                document.getElementById('kredi-parcali-hesap-alani').style.display = 'none';
            }
        }

        function addParcaKredi() {
            const container = document.getElementById('kredi-parcalar-container');
            if(container.querySelectorAll('.parca-satiri-kredi').length >= 5) { alert("En fazla 5 parçaya bölebilirsiniz."); return; }
            const row = document.createElement('div'); row.className = 'parca-satiri-kredi';
            row.style.cssText = "display: grid; grid-template-columns: 1.5fr 1fr auto; gap: 8px; margin-bottom: 10px; align-items: start;";
            const uniqueId = 'parca-kr-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
            row.innerHTML = `<select id="${uniqueId}" class="form-control parca-hesap-kredi" style="padding: 10px; font-size: 13px;">${window.hesapOptions}</select><input type="text" inputmode="decimal" class="form-control parca-tutar-kredi" placeholder="Tutar" oninput="tutarFormatla(this); hesaplaKalanParcaliKredi()" style="padding: 10px; font-size: 14px;"><button onclick="this.parentElement.remove(); hesaplaKalanParcaliKredi();" style="background: rgba(244, 63, 94, 0.15); border: none; color: var(--rose); width: 38px; height: 38px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>`;
            container.appendChild(row); refreshCustomSelect(document.getElementById(uniqueId));
        }

        function hesaplaKalanParcaliKredi() {
            const hedefTutar = parseSaha(document.getElementById('kredi-ode-tutar').value) || 0;
            let girilenToplam = 0; document.querySelectorAll('.parca-tutar-kredi').forEach(inp => girilenToplam += parseSaha(inp.value) || 0);
            const kalan = hedefTutar - girilenToplam;
            document.getElementById('kredi-hedef-tutar').innerText = "₺" + hedefTutar.toLocaleString('tr-TR', {minimumFractionDigits:2});
            const kalanEl = document.getElementById('kredi-kalan-tutar');
            if(kalan === 0) { kalanEl.style.color = "var(--emerald)"; kalanEl.innerText = "₺0,00"; }
            else if (kalan < 0) { kalanEl.style.color = "var(--rose)"; kalanEl.innerText = "Fazla: ₺" + Math.abs(kalan).toLocaleString('tr-TR', {minimumFractionDigits:2}); }
            else { kalanEl.style.color = "var(--amber)"; kalanEl.innerText = "₺" + kalan.toLocaleString('tr-TR', {minimumFractionDigits:2}); }
        }

        function toggleParcaliOzelOdeme() {
            const sekil = getCustomVal('ozel-odeme-sekli');
            if(sekil === 'parcali') {
                document.getElementById('ozel-tek-hesap-alani').style.display = 'none';
                document.getElementById('ozel-parcali-hesap-alani').style.display = 'block';
                document.getElementById('ozel-parcalar-container').innerHTML = '';
                addParcaOzel(); addParcaOzel(); hesaplaKalanParcaliOzel();
            } else {
                document.getElementById('ozel-tek-hesap-alani').style.display = 'block';
                document.getElementById('ozel-parcali-hesap-alani').style.display = 'none';
            }
        }

        function addParcaOzel() {
            const container = document.getElementById('ozel-parcalar-container');
            if(container.querySelectorAll('.parca-satiri-ozel').length >= 5) { alert("En fazla 5 parçaya bölebilirsiniz."); return; }
            const row = document.createElement('div'); row.className = 'parca-satiri-ozel';
            row.style.cssText = "display: grid; grid-template-columns: 1.5fr 1fr auto; gap: 8px; margin-bottom: 10px; align-items: start;";
            const uniqueId = 'parca-oz-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
            row.innerHTML = `<select id="${uniqueId}" class="form-control parca-hesap-ozel" style="padding: 10px; font-size: 13px;">${window.hesapOptions}</select><input type="text" inputmode="decimal" class="form-control parca-tutar-ozel" placeholder="Tutar" oninput="tutarFormatla(this); hesaplaKalanParcaliOzel()" style="padding: 10px; font-size: 14px;"><button onclick="this.parentElement.remove(); hesaplaKalanParcaliOzel();" style="background: rgba(244, 63, 94, 0.15); border: none; color: var(--rose); width: 38px; height: 38px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>`;
            container.appendChild(row); refreshCustomSelect(document.getElementById(uniqueId));
        }

        function hesaplaKalanParcaliOzel() {
            const hedefTutar = parseSaha(document.getElementById('ozel-ode-tutar').value) || 0;
            let girilenToplam = 0; document.querySelectorAll('.parca-tutar-ozel').forEach(inp => girilenToplam += parseSaha(inp.value) || 0);
            const kalan = hedefTutar - girilenToplam;
            document.getElementById('ozel-hedef-tutar').innerText = "₺" + hedefTutar.toLocaleString('tr-TR', {minimumFractionDigits:2});
            const kalanEl = document.getElementById('ozel-kalan-tutar');
            if(kalan === 0) { kalanEl.style.color = "var(--emerald)"; kalanEl.innerText = "₺0,00"; }
            else if (kalan < 0) { kalanEl.style.color = "var(--rose)"; kalanEl.innerText = "Fazla: ₺" + Math.abs(kalan).toLocaleString('tr-TR', {minimumFractionDigits:2}); }
            else { kalanEl.style.color = "var(--amber)"; kalanEl.innerText = "₺" + kalan.toLocaleString('tr-TR', {minimumFractionDigits:2}); }
        }

        function hesaplaKrediKarZarar() {
            const secim = getCustomVal('kredi-secim');
            const kutu = document.getElementById('kredi-kar-zarar-kutu');
            const rakamEl = document.getElementById('kredi-kar-rakam');
            const girilenTutar = parseSaha(document.getElementById('kredi-ode-tutar').value) || 0;

            if (!secim || secim.includes("Seçin") || girilenTutar <= 0) {
                if (kutu) kutu.style.display = 'none';
                return;
            }

            // Sistemdeki kredi bakiyesini bul (borclarListe içinden evrensel sorgu)
            const krediObj = window.currentStats.borclarListe.find(b => b.isim === secim);
            if (krediObj && krediObj.tutar > 0) {
                const kar = krediObj.tutar - girilenTutar;
                if (kutu) kutu.style.display = 'block';
                rakamEl.innerHTML = formatTL(kar);
            } else {
                if (kutu) kutu.style.display = 'none';
            }
        }

        function submitKrediOde() {
            const borcAdi = getCustomVal('kredi-secim'); const tutar = document.getElementById('kredi-ode-tutar').value;
            const sekil = getCustomVal('kredi-odeme-sekli'); const secilenTarih = document.getElementById('kredi-tarih').value;
            let err = false;
            if(!borcAdi || borcAdi.includes("Seçin")) { markError('kredi-secim'); err = true; }
            if(!tutar || parseSaha(tutar) <= 0) { markError('kredi-ode-tutar'); err = true; }
            if(!secilenTarih) { markError('kredi-tarih'); err = true; }
            if(err) return;
            
            // KULLANICI ONAY ZIRHI
            if(!confirm("Erken kapatma işlemini onaylarsanız seçtiğiniz kredi sistemden (Borçlar ve Sabit Kurallar sayfasından) tamamen silinecektir, onaylıyor musunuz?")) return;

            const simdi = new Date(); const tParca = secilenTarih.split('-');
            const tamTarihLog = `${tParca[2]}.${tParca[1]}.${tParca[0]} ${String(simdi.getHours()).padStart(2,'0')}:${String(simdi.getMinutes()).padStart(2,'0')}`;
            
            // Backend'deki yeni evrensel erken kapama modülüne yollanıyor
            let payload = { action: "kredi_erken_kapama", borc_adi: borcAdi, tutar: tutar, tarih: tamTarihLog, odeme_sekli: sekil };
            if(sekil === 'parcali') {
                const parcalar = []; let hataVar = false;
                document.querySelectorAll('.parca-satiri-kredi').forEach(row => {
                    let yontem = row.querySelector('.parca-hesap-kredi').value;
                    if(!yontem) { const spanTxt = row.querySelector('.custom-select-trigger span'); if(spanTxt) yontem = spanTxt.innerText; }
                    const pTutarVal = parseSaha(row.querySelector('.parca-tutar-kredi').value);
                    if(pTutarVal <= 0) { row.querySelector('.parca-tutar-kredi').classList.add('error'); hataVar = true; }
                    else { parcalar.push({ yontem: yontem, tutar: pTutarVal }); }
                });
                if(hataVar || parcalar.length === 0) return alert("Hatalı ödeme tutarı.");
                payload.parcalar = parcalar; payload.odeme_turu = window.hesapTurleri[parcalar[0].yontem] || "Banka Hesabı";
            } else {
                let tekYontem = getCustomVal('kredi-yontem');
                if(!tekYontem || tekYontem.includes("Seçin")) return markError('kredi-yontem');
                payload.yontem = tekYontem; payload.odeme_turu = window.hesapTurleri[tekYontem] || "Banka Hesabı";
            }
            apiIstekAt(payload, 'btn-submit-kredi-ode');
        }

        function submitYeniKredi() {
            const isim = document.getElementById('kredi-yeni-isim').value.trim(); const tutar = document.getElementById('kredi-yeni-tutar').value;
            const vade = document.getElementById('kredi-yeni-vade').value; const aylik = document.getElementById('kredi-yeni-aylik').value;
            const gun = document.getElementById('kredi-yeni-gun').value; const hesap = getCustomVal('kredi-yeni-hesap');
            const tarih = document.getElementById('kredi-yeni-tarih').value;
            const bitis = document.getElementById('kredi-yeni-bitis').value; // Yeni eklenen
            
            let err = false;
            if(!isim) { markError('kredi-yeni-isim'); err = true; } if(!tutar) { markError('kredi-yeni-tutar'); err = true; }
            if(!vade) { markError('kredi-yeni-vade'); err = true; } if(!aylik) { markError('kredi-yeni-aylik'); err = true; }
            if(!gun) { markError('kredi-yeni-gun'); err = true; } if(!bitis) { markError('kredi-yeni-bitis'); err = true; } 
            if(!hesap || hesap.includes("Seçin")) { markError('kredi-yeni-hesap'); err = true; }
            if(!tarih) { markError('kredi-yeni-tarih'); err = true; }
            
            if(err) return;
            
            const simdi = new Date(); const tParca = tarih.split('-');
            const tamTarihLog = `${tParca[2]}.${tParca[1]}.${tParca[0]} ${String(simdi.getHours()).padStart(2,'0')}:${String(simdi.getMinutes()).padStart(2,'0')}`;
            
            apiIstekAt({ action: "yeni_kredi", isim: isim, tutar: tutar, vade: vade, aylik_taksit: aylik, gun: gun, bitis_tarihi: bitis, hesap: hesap, tarih: tamTarihLog, odeme_turu: window.hesapTurleri[hesap] || "Banka Hesabı" }, 'btn-submit-kredi-tanimla');
        }

        function submitOzelOde() {
            const borcAdi = getCustomVal('ozel-secim'); const tutar = document.getElementById('ozel-ode-tutar').value;
            const sekil = getCustomVal('ozel-odeme-sekli'); const secilenTarih = document.getElementById('ozel-tarih').value;
            let err = false;
            if(!borcAdi || borcAdi.includes("Seçin")) { markError('ozel-secim'); err = true; }
            if(!tutar || parseSaha(tutar) <= 0) { markError('ozel-ode-tutar'); err = true; }
            if(!secilenTarih) { markError('ozel-tarih'); err = true; }
            if(err) return;
            const simdi = new Date(); const tParca = secilenTarih.split('-');
            const tamTarihLog = `${tParca[2]}.${tParca[1]}.${tParca[0]} ${String(simdi.getHours()).padStart(2,'0')}:${String(simdi.getMinutes()).padStart(2,'0')}`;
            let payload = { action: "ozel_borc_ode", borc_adi: borcAdi, tutar: tutar, tarih: tamTarihLog, odeme_sekli: sekil };
            if(sekil === 'parcali') {
                const parcalar = []; let hataVar = false;
                document.querySelectorAll('.parca-satiri-ozel').forEach(row => {
                    let yontem = row.querySelector('.parca-hesap-ozel').value;
                    if(!yontem) { const spanTxt = row.querySelector('.custom-select-trigger span'); if(spanTxt) yontem = spanTxt.innerText; }
                    const pTutarVal = parseSaha(row.querySelector('.parca-tutar-ozel').value);
                    if(pTutarVal <= 0) { row.querySelector('.parca-tutar-ozel').classList.add('error'); hataVar = true; }
                    else { parcalar.push({ yontem: yontem, tutar: pTutarVal }); }
                });
                if(hataVar || parcalar.length === 0) return alert("Hatalı ödeme tutarı.");
                payload.parcalar = parcalar; payload.odeme_turu = window.hesapTurleri[parcalar[0].yontem] || "Banka Hesabı";
            } else {
                let tekYontem = getCustomVal('ozel-yontem');
                if(!tekYontem || tekYontem.includes("Seçin")) return markError('ozel-yontem');
                payload.yontem = tekYontem; payload.odeme_turu = window.hesapTurleri[tekYontem] || "Banka Hesabı";
            }
            apiIstekAt(payload, 'btn-submit-ozel-ode');
        }

        function submitOzelGuncelle() {
            const isim = getCustomVal('ozel-guncelle-secim'); const yeniTutar = document.getElementById('ozel-guncelle-tutar').value;
            if(!isim || isim.includes("Seçin")) return markError('ozel-guncelle-secim');
            if(!yeniTutar) return markError('ozel-guncelle-tutar');
            apiIstekAt({ action: "ozel_borc_guncelle", isim: isim, yeni_tutar: yeniTutar }, 'btn-submit-ozel-guncelle');
        }

        function submitYeniOzel() {
            const isim = document.getElementById('ozel-yeni-isim').value.trim(); const tutar = document.getElementById('ozel-yeni-tutar').value;
            const tarih = document.getElementById('ozel-yeni-tarih').value;
            let err = false;
            if(!isim) { markError('ozel-yeni-isim'); err = true; } if(!tutar) { markError('ozel-yeni-tutar'); err = true; }
            if(!tarih) { markError('ozel-yeni-tarih'); err = true; }
            if(err) return;
            const simdi = new Date(); const tParca = tarih.split('-');
            const tamTarihLog = `${tParca[2]}.${tParca[1]}.${tParca[0]} ${String(simdi.getHours()).padStart(2,'0')}:${String(simdi.getMinutes()).padStart(2,'0')}`;
            // Evrensellik: Vade parametresi direkt "-" olarak Backend'e gönderilir
            apiIstekAt({ action: "yeni_ozel_borc", isim: isim, tutar: tutar, vade: "-", tarih: tamTarihLog }, 'btn-submit-ozel-tanimla');
        }
        
                        function doldurSabitGuncelleForm() {
    const select = document.getElementById('sg-kural'); const opt = select.options[select.selectedIndex];
    const formAlani = document.getElementById('sabit-guncelle-form-alani');

    if(!opt || !opt.value || opt.value === "") {
        document.getElementById('sg-tutar').value = ""; document.getElementById('sg-gun').value = "";
        document.getElementById('sg-sure').value = "";
        if(formAlani) formAlani.style.display = 'none';
        return;
    }
    if(formAlani) formAlani.style.display = 'block';

    // --- NİHAİ ÇÖZÜM: Güncelleme kutusuna da doğrudan TR formatında basıyoruz ---
    const sTutar = parseFloat(opt.getAttribute('data-tutar')) || 0;
    document.getElementById('sg-tutar').value = sTutar.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2});

    document.getElementById('sg-gun').value = opt.getAttribute('data-gun');
    document.getElementById('sg-sure').value = opt.getAttribute('data-sure');

    const yontem = opt.getAttribute('data-yontem'); 
    const durum = opt.getAttribute('data-durum');
    const yon = opt.getAttribute('data-yon'); 

    const yontemSel = document.getElementById('sg-yontem');
    if(yontemSel) { 
        yontemSel.innerHTML = (yon === 'Gelir') ? window.vadesizOptions : window.hesapOptions;
        yontemSel.value = yontem; 
        refreshCustomSelect(yontemSel); 
    }
    const durumSel = document.getElementById('sg-durum');
    if(durumSel) { durumSel.value = durum; refreshCustomSelect(durumSel); }
}

        function submitSabitGuncelle() {
            if(!confirm("Bu güncelleme, kuralın bugünden sonraki işlemlerine yansıyacaktır. Geçmiş aylardaki ödemelerinizi ve bakiyelerinizi etkilemeyecektir. Devam etmek istiyor musunuz?")) return
            ;
        const kuralSatir = getCustomVal('sg-kural');
        const tutar = document.getElementById('sg-tutar').value;
        const gun = document.getElementById('sg-gun').value;
        const sure = document.getElementById('sg-sure').value;
        const yontem = getCustomVal('sg-yontem');
        const durum = getCustomVal('sg-durum');

        if(!kuralSatir) return markError('sg-kural');
        if(!tutar) return markError('sg-tutar');

        apiIstekAt({
            action: "sabit_guncelle",
            satir: kuralSatir,
            yeni_tutar: tutar,
            yeni_gun: gun,
            yeni_sure: sure,
            yeni_yontem: yontem,
            yeni_durum: durum
        }, 'btn-submit-sabit-guncelle');
    }

    function checkYeniHesapTur() {
        const tur = document.getElementById('yh-tur').value;
        const kmhGrubu = document.getElementById('yh-kmh-grubu');
        if (tur === "Nakit") {
            kmhGrubu.style.display = 'none';
            document.getElementById('yh-kmh').value = "0";
        } else {
            kmhGrubu.style.display = 'block';
        }
    }

    function submitYeniHesap() {
        const isim = document.getElementById('yh-isim').value;
        const bakiye = document.getElementById('yh-bakiye').value;
        const tur = document.getElementById('yh-tur').value;
        const kmh = document.getElementById('yh-kmh').value;

        if(!isim) return markError('yh-isim');
        if(!bakiye) return markError('yh-bakiye');

        apiIstekAt({
            action: "yeni_hesap",
            hesap_adi: isim,
            bakiye: bakiye,
            hesap_turu: tur,
            kmh_limit: kmh || 0
        }, 'btn-submit-yeni-hesap');
    }

    function submitYeniKart() {
        const isim = document.getElementById('yk-isim').value;
        const limit = document.getElementById('yk-limit').value;
        const ekstre = document.getElementById('yk-ekstre').value;
        const borc = document.getElementById('yk-borc').value || 0;

        if(!isim) return markError('yk-isim');
        if(!limit) return markError('yk-limit');
        if(!ekstre) return markError('yk-ekstre');

        apiIstekAt({
            action: "yeni_kart_ekle",
            hesap_adi: isim,
            limit: limit,
            ekstre_gunu: ekstre,
            bakiye: borc
        }, 'btn-submit-yeni-kart');
    }

        function updateMevcutLimit() {
  const kartAdi = getCustomVal('kl-secim');
  const grup = document.getElementById('kl-mevcut-limit-grup');
  const valEl = document.getElementById('kl-mevcut-val');
  
  if(!kartAdi || kartAdi.includes("Seçin")) { 
    grup.style.display = 'none'; 
    return; 
  }
  
  // Uygulamanın hafızasındaki (window.kartlarDetayli) kart verisini bulur
  const kart = window.kartlarDetayli.find(k => k.isim === kartAdi);
  if(kart) {
    grup.style.display = 'block';
    valEl.innerHTML = formatTL(kart.limit); // Mevcut limiti TL formatında gösterir
  } else { 
    grup.style.display = 'none'; 
  }
}

    function submitLimitGuncelle() {
        const isim = getCustomVal('kl-secim');
        const limit = document.getElementById('kl-yeni-limit').value;
        if(!isim) return markError('kl-secim');
        if(!limit) return markError('kl-yeni-limit');
        apiIstekAt({ action: "kart_limiti_guncelle", kart_adi: isim, yeni_limit: limit }, 'btn-submit-limit-guncelle');
    }

    function submitEkstreGuncelle() {
        const isim = getCustomVal('keg-secim');
        const gun = document.getElementById('keg-yeni-gun').value;
        if(!isim) return markError('keg-secim');
        if(!gun) return markError('keg-yeni-gun');
        apiIstekAt({ action: "kart_ekstre_guncelle", kart_adi: isim, yeni_gun: gun }, 'btn-submit-ekstre-guncelle');
    }

        function showGeriAlEkrani() {
        vibe();
        const listContainer = document.getElementById('geri-al-list-container');
        let html = "";

        if (!window.currentStats.sonIslemler || window.currentStats.sonIslemler.length === 0 || window.currentStats.sonIslemler[0].tarih === "-") {
            html = `<div style="text-align:center; padding: 20px; color:var(--text-muted); font-size: 13px;">Geri alınabilecek işlem bulunamadı.</div>`;
        } else {
            // Son 5 işlemi ekrana döküyoruz
            let islemler = window.currentStats.sonIslemler.slice(0, 5);
            islemler.forEach((islem, index) => {
                let btnId = `btn-gerial-${index}`;
                let isaret = islem.tur === 'Gelir' ? '+' : (islem.tur === 'Transfer' ? '' : '-');
                let renkClass = islem.tur === 'Gelir' ? 'text-green' : (islem.tur === 'Transfer' ? 'text-gray' : 'text-red');
                let detay = islem.tur === 'Gelir' ? (islem.hedef || islem.odeme) : islem.odeme;
                if((islem.tur === 'Transfer' || islem.tur === 'Kart Ödemesi' || islem.tur === 'Borç Ödemesi') && islem.hedef) detay = `${islem.odeme} ➔ ${islem.hedef}`;
                
                html += `
                <div class="t-row" style="background: rgba(244, 63, 94, 0.05); padding: 14px; border-radius: 12px; margin-bottom: 10px; border: 1px dashed rgba(244, 63, 94, 0.2); cursor:pointer; align-items:center;" onclick="geriAlOnayla('${islem.satir}', '${islem.kalem}', '${btnId}')">
                    <div class="t-details" style="flex:1;">
                        <div class="t-name" style="font-size: 14px; font-weight: 600; color: #fff; margin-bottom:4px;">${islem.kalem}</div>
                        <div class="t-meta" style="font-size: 11px;">${islem.tarih} • ${detay}</div>
                    </div>
                    <div class="t-amt ${renkClass}" style="font-size: 16px; font-weight: 800;">${isaret}${formatTL(islem.tutar)}</div>
                    <div id="${btnId}" style="margin-left: 10px; color: var(--rose);">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
                    </div>
                </div>`;
            });
        }
        listContainer.innerHTML = html;
        showSection('section-geri-al', 'İşlem Geri Al');
    }

    function geriAlOnayla(satir, kalemIsmi, btnId) {
        if(!confirm(`"${kalemIsmi}" işlemini tamamen geri almak istediğinize emin misiniz? (İlgili bakiyeler ve kurallar onarılacaktır)`)) return;
        
        // Cerrahi silme işlemi için API'ye Satır ve Kalem adını gönderiyoruz
        apiIstekAt({ action: 'geri_al', satir: satir, kalem: kalemIsmi }, btnId);
    }

    function refreshCustomSelect(selectElement) {
        if(!selectElement) return;
        const wrapperId = 'custom-sel-' + selectElement.id;
        let wrapper = document.getElementById(wrapperId);
        
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.id = wrapperId;
            wrapper.className = 'custom-select-wrapper';
            selectElement.parentNode.insertBefore(wrapper, selectElement);
            wrapper.appendChild(selectElement);
            selectElement.style.display = 'none';
        } else {
            const oldTrigger = wrapper.querySelector('.custom-select-trigger');
            const oldOptions = wrapper.querySelector('.custom-options');
            if(oldTrigger) oldTrigger.remove();
            if(oldOptions) oldOptions.remove();
        }

        const trigger = document.createElement('div');
        trigger.className = 'custom-select-trigger';
        const selectedOpt = selectElement.options[selectElement.selectedIndex] || selectElement.options[0];
        const triggerText = selectedOpt ? selectedOpt.text : 'Seçiniz...';
        
        trigger.innerHTML = `<span>${triggerText}</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
        
        const customOptions = document.createElement('div');
        customOptions.className = 'custom-options custom-scrollbar';
        
        Array.from(selectElement.options).forEach((opt, index) => {
            if(opt.value === "") return;
            const optionDiv = document.createElement('div');
            optionDiv.className = 'custom-option text-truncate' + (opt.selected ? ' selected' : '');
            optionDiv.innerHTML = opt.text;
            optionDiv.addEventListener('click', function(e) {
                e.stopPropagation();
                selectElement.selectedIndex = index;
                selectElement.dispatchEvent(new Event('change'));
                trigger.querySelector('span').innerText = opt.text;
                wrapper.classList.remove('open');
                Array.from(customOptions.children).forEach(c => c.classList.remove('selected'));
                this.classList.add('selected');
            });
            customOptions.appendChild(optionDiv);
        });
        
        trigger.addEventListener('click', function(e) {
            e.stopPropagation();
            document.querySelectorAll('.custom-select-wrapper').forEach(w => {
                if (w !== wrapper) w.classList.remove('open');
            });
            wrapper.classList.toggle('open');
        });
        
        wrapper.appendChild(trigger);
        wrapper.appendChild(customOptions);
    }

    document.addEventListener('click', function() {
        document.querySelectorAll('.custom-select-wrapper').forEach(w => w.classList.remove('open'));
    });

function tutarFormatla(input) {
    let cursorPosition = input.selectionStart;
    let originalLength = input.value.length;
    let value = input.value;

    let isNegative = value.startsWith('-');
    // Sadece rakam ve virgül kalacak şekilde temizle (Senin kuralın)
    value = value.replace(/[^0-9,]/g, '');

    let parts = value.split(',');
    if (parts.length > 2) value = parts[0] + ',' + parts.slice(1).join('');

    parts = value.split(',');
    // Binlik noktalarını yerleştir (Senin kuralın)
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");

    let finalValue = (isNegative ? '-' : '') + parts.join(',');
    input.value = finalValue;

    // --- KRİTİK EMEK: Evrensellik Kimliği (Aynen Korundu) ---
    input.dataset.isCurrency = "true"; 

    // --- KRİTİK DÜZELTME: İMLEÇ SIRALAMASI ---
    // 9650 yazarken araya nokta girdiğinde imlecin yerini korur, rakam yutmaz.
    let newLength = input.value.length;
    cursorPosition = cursorPosition + (newLength - originalLength);
    input.setSelectionRange(cursorPosition, cursorPosition);

    // --- TETİKLEYİCİ: Eğer anlık işlem kutusuysa aşağıyı güncelle ---
    if (input.id === 'an-tutar' || input.classList.contains('an-parca-tutar')) {
        if(typeof hesaplaKalanParcaliAnlik === 'function') {
            hesaplaKalanParcaliAnlik();
        }
    }
}

        // =========================================================================
    // 1. BÖLÜM: KAPORTA (SADECE EKRANI ÇİZEN FONKSİYON)
    // =========================================================================
    function ekraniCiz(data, ilkAcilisMi = false) {
                // =========================================================
        // YENİ AY HAYALET VERİ ZIRHI (ÇÖKMELERİ KESİN ÖNLER)
        // =========================================================
        if (!data.buAyIslemler || data.buAyIslemler.length === 0) {
            data.buAyIslemler = [{ tarih: "-", tur: "Gider", kategori: "Yok", kalem: "Henüz İşlem Yok", odeme: "-", tutar: 0, hedef: "-" }];
        }
        if (!data.sonIslemler || data.sonIslemler.length === 0) {
            data.sonIslemler = [{ tarih: "-", tur: "Gider", kategori: "Yok", kalem: "Henüz İşlem Yok", odeme: "-", tutar: 0, hedef: "-" }];
        }
        if (!data.pastaGrafik || data.pastaGrafik.length === 0) {
            data.pastaGrafik = [{ isim: "İşlem Yok", toplam: 0 }];
        }
        // =========================================================
        // --- YENİ AY BOŞ VERİ ZIRHI (CRASH KORUMASI) ---
        // Diziler için koruma
        data.faizDetaylari = data.faizDetaylari || [];
        data.varliklarListe = data.varliklarListe || [];
        data.borclarListe = data.borclarListe || [];
        data.bankalar = data.bankalar || [];
        data.kartlarDetayli = data.kartlarDetayli || [];
        data.sonIslemler = data.sonIslemler || [];
        data.buAyIslemler = data.buAyIslemler || [];
        data.tumSabitlerListe = data.tumSabitlerListe || [];
        data.yaklasanOdemeler = data.yaklasanOdemeler || [];
        data.ilerlemeBarlari = data.ilerlemeBarlari || [];
        data.tarihce = data.tarihce || [];
        
        // Rakamlar için koruma (NaN hatalarını önler)
        data.netServet = data.netServet || 0;
        data.netServetUSD = data.netServetUSD || 0;
        data.toplamKasa = data.toplamKasa || 0;
        data.toplamBorc = data.toplamBorc || 0;
        data.toplamCanYakan = data.toplamCanYakan || 0;
        data.toplamPlanli = data.toplamPlanli || 0;
        data.tahminiFaiz = data.tahminiFaiz || 0;
        data.toplamOdenenFaiz = data.toplamOdenenFaiz || 0;
        data.backendSafHarcama = data.backendSafHarcama || 0;
        data.backendGunlukOrtalama = data.backendGunlukOrtalama || 0;
        data.backendNetNakit = data.backendNetNakit || 0;
        data.yaklasanToplam = data.yaklasanToplam || 0;
        // -----------------------------------------------

        window.currentStats = data;
        window.tarihceData = data.tarihce || [];
        window.dinamikKategoriler = data.dinamikKategoriler || window.dinamikKategoriler;

        // EKRAN GÜNCELLEME HİLESİ: İlk açılışta animasyon (1000ms), arka plan güncellemesinde anında değişim (10ms)
        let aSure = ilkAcilisMi ? 1000 : 10;

        animateValue('val-net-servet', data.netServet, aSure);
        animateValueUSD('val-net-servet-usd', data.netServetUSD, aSure);

                    // --- MİMAR DOKUNUŞU: Kur Bilgisini Ekrana Bas (Zırhlı) ---
        const kurEl = document.getElementById('usd-kur-bilgisi');
        let guncelKur = parseSaha(data.usdRate); // Backendden ne gelirse gelsin rakama çevirir
        if (kurEl && guncelKur > 0) {
            kurEl.innerText = `(Güncel Kur: ₺${guncelKur.toLocaleString('tr-TR', {minimumFractionDigits:2, maximumFractionDigits:2})})`;
        }

        // Net Varlık Dinamik Renk Zırhı
        const netServetEl = document.getElementById('val-net-servet');
        if (netServetEl) {
            netServetEl.style.color = data.netServet < 0 ? 'var(--rose)' : 'var(--emerald)';
        }

        setText('val-borc-varlik-orani', data.borcVarlikOrani);
        setText('val-nakit-koruma', data.nakitKorumaSuresi + ' Ay');
                animateValue('val-kasa', data.toplamKasa, aSure);
        animateValue('val-borc', data.toplamBorc, aSure);
        
        // --- MİMAR DOKUNUŞU: "Sıfır Stres" Psikoloji Motoru ---
        const canYakanKutu = document.getElementById('val-borc-acil');
        const canYakanLabel = canYakanKutu ? canYakanKutu.parentElement.querySelector('.summary-label') : null;
        if (canYakanKutu && canYakanLabel) {
            if (data.toplamCanYakan === 0) {
                // Borç sıfırsa Zümrüt Yeşili ve Başarı İkonu
                canYakanLabel.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:5px;"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="m9 12 2 2 4-4"></path></svg> Sıfır Stres`;
                canYakanLabel.style.color = 'var(--emerald)';
                canYakanKutu.style.color = 'var(--emerald)';
            } else {
                // Borç varsa Orijinal Kırmızı Uyarı
                canYakanLabel.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:5px;"><path d="M12 2c0 0-5 6.5-5 11a5 5 0 0 0 10 0c0-4.5-5-11-5-11Z"/><path d="M12 13a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/></svg> Can Yakan`;
                canYakanLabel.style.color = 'var(--rose)';
                canYakanKutu.style.color = 'var(--rose)';
            }
        }
        animateValue('val-borc-acil', data.toplamCanYakan, aSure);
        animateValue('val-borc-planli', data.toplamPlanli, aSure);
        animateValue('val-tahmini-faiz', data.tahminiFaiz, aSure);
        animateValue('val-gecen-ay-faiz', data.gecenAyFaiz, aSure);
        animateValue('val-toplam-odenen-faiz', data.toplamOdenenFaiz, aSure);
        animateValue('val-aylik-faiz', data.aylikFaizGuncel, aSure);

        updateTrends(0, document.querySelectorAll('.time-btn')[0]);

        const fListe = document.getElementById('faiz-detay-listesi');
        let fHtml = "";
        if (data.faizDetaylari && data.faizDetaylari.length > 0) {
            data.faizDetaylari.forEach(f => {
                fHtml += `<div class="list-row"><div class="list-label"><span style="background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 6px; font-size: 11px; margin-right: 8px;">${f.tur}</span> ${f.banka}</div><div class="list-value text-red">${formatTL(f.aylik)}</div></div>`;
            });
        } else {
            fHtml = `<div class="list-row" style="border:none; padding:8px 0;"><span class="list-label" style="font-size:13px; color:var(--text-muted);">Bu ay gerçekleşen faiz yok.</span></div>`;
        }
                    fHtml += `
        <div style="margin-top:15px;">
            <button onclick="triggerFaizOde(this)" style="width:100%; height:36px; background:rgba(244, 63, 94, 0.12); border:1px solid rgba(244, 63, 94, 0.25); color:var(--rose); border-radius:10px; font-size:11px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;">
                <i class="fas fa-money-bill-trend-up" style="font-size:13px;"></i> FAİZ ÖDEMESİ GİR
            </button>
        </div>`;
        fListe.innerHTML = fHtml;

                        const vListe = document.getElementById('varlik-listesi');
        let vHtml = "";
        
        // Evrensel Varlık Havuzu (Fiziki Varlıklar + Artı Bakiyeli Bankalar/Nakit)
        let tumVarliklarHavuzu = [...data.varliklarListe];
        if (data.bankalar) {
            data.bankalar.forEach(banka => {
                // KUSURSUZ ZIRH: Bakiye en az 1 kuruş (0.01) ise listeye dahil et
                if (parseFloat(banka.bakiye) >= 0.01) { 
                    tumVarliklarHavuzu.push({ isim: banka.isim, deger: banka.bakiye }); 
                }
            });
        }

        // KUSURSUZ ZIRH 2: Listeyi ekrana basmadan önce son kez kontrol et
        let filtrelenmisVarliklar = tumVarliklarHavuzu.filter(v => parseFloat(v.deger) >= 0.01);

        let anlikToplamVarlik = 0;
        filtrelenmisVarliklar.forEach(v => anlikToplamVarlik += parseFloat(v.deger) || 0);

        filtrelenmisVarliklar.sort((a, b) => parseFloat(b.deger) - parseFloat(a.deger)).forEach(v => {
            let val = parseFloat(v.deger) || 0;
            let p = anlikToplamVarlik > 0 ? Math.round((val / anlikToplamVarlik) * 100) : 0;
            vHtml += `<div class="t-row"><div class="t-details"><div class="t-name">${v.isim}</div><div class="progress-container" style="height:4px; margin-top:6px; background:rgba(255,255,255,0.05);"><div class="progress-bar" style="width:${p}%; background:var(--emerald);"></div></div></div><div class="t-amt text-green">${formatTL(val)}</div></div>`;
        });
        
        // Alt kısımdaki gereksiz toplam satırı tamamen SİLİNDİ
        vListe.innerHTML = vHtml;

        // BAŞLIĞA TOPLAM VARLIĞI YAZDIRMA
        const headerVarlikEl = document.getElementById('header-toplam-varlik');
        if (headerVarlikEl) headerVarlikEl.innerHTML = formatTL(anlikToplamVarlik);


        const bListe = document.getElementById('borc-listesi');
        let bHtml = "";
        let tumBorclarHavuzu = [...data.borclarListe];

        if(data.bankalar) {
          data.bankalar.forEach(banka => {
            // KMH Borcu için en az -0.01 zırhı
            if(parseFloat(banka.bakiye) <= -0.01) { tumBorclarHavuzu.push({ isim: banka.isim + " (KMH)", tutar: Math.abs(parseFloat(banka.bakiye)) }); }
          });
        }
        if(data.kartlarDetayli) {
          data.kartlarDetayli.forEach(kart => {
            if(parseFloat(kart.borc) >= 0.01) { tumBorclarHavuzu.push({ isim: kart.isim, tutar: kart.borc }); }
          });
        }

        // KUSURSUZ ZIRH: Sadece borcu 1 kuruştan büyük olanları listele
        let filtrelenmisBorclar = tumBorclarHavuzu.filter(b => parseFloat(b.tutar) >= 0.01);

        filtrelenmisBorclar.sort((a, b) => parseFloat(b.tutar) - parseFloat(a.tutar)).forEach(b => {
          let val = parseFloat(b.tutar) || 0;
          let p = data.toplamBorc > 0 ? Math.round((val / data.toplamBorc) * 100) : 0;
          bHtml += `<div class="t-row"><div class="t-details"><div class="t-name">${b.isim}</div><div class="progress-container" style="height:4px; margin-top:6px; background:rgba(255,255,255,0.05);"><div class="progress-bar" style="width:${p}%; background:var(--rose);"></div></div></div><div class="t-amt text-red">${formatTL(val)}</div></div>`;
        });

                    bHtml += `
        <div style="margin-top:15px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.05);">
            <button onclick="this.style.pointerEvents='none'; loadSabitlerAndShow('ozel-borc-islemleri-screen', 'ozel-secim', 'Şahıs & Özel Borçlar').then(() => { const m=document.getElementById('action-modal'); const b=document.getElementById('fab-btn'); m.classList.add('active'); b.classList.add('open'); document.body.classList.add('modal-open'); toggleOzelTab('ode'); this.style.pointerEvents='auto'; });" style="width:100%; height:38px; background:rgba(244, 63, 94, 0.1); border:1px solid rgba(244, 63, 94, 0.2); color:var(--rose); border-radius:10px; font-size:12px; font-weight:800; display:flex; align-items:center; justify-content:center; gap:8px; cursor:pointer;">
                <i class="fas fa-hand-holding-dollar"></i> ÖZEL BORÇ ÖDE
            </button>
        </div>`;
        
        // Alt kısımdaki gereksiz toplam satırı tamamen SİLİNDİ
        bListe.innerHTML = bHtml;

        // BAŞLIĞA TOPLAM BORCU YAZDIRMA
        const headerBorcEl = document.getElementById('header-toplam-borc');
        if (headerBorcEl) headerBorcEl.innerHTML = formatTL(data.toplamBorc);

        const bankaList = document.getElementById('banka-listesi');
        let bankaHtml = "";
        let toplamLikidite = 0; // MİMAR EKLENTİSİ: Sıcak Para Havuzu

        data.bankalar.sort((a, b) => {
            if (a.isim.trim().toLowerCase() === "nakit") return -1;
            if (b.isim.trim().toLowerCase() === "nakit") return 1;
            return 0;
        });

        data.bankalar.forEach(b => {
            let icon = b.tur === "Nakit" ? '<i class="fas fa-wallet" style="color:var(--emerald); margin-right:8px;"></i>' : '<i class="fas fa-university" style="color:var(--blue); margin-right:8px;"></i>';
            let tutarRengi = b.bakiye < 0 ? 'text-red' : 'text-green';
            let kmhDurumu = "";
            if(b.bakiye < 0 && b.limit > 0) {
                let kYuzde = Math.round((Math.abs(b.bakiye) / b.limit) * 100);
                kmhDurumu = `<div style="font-size:10px; color:var(--text-muted); margin-top:4px;">KMH Kullanımı: %${kYuzde}</div>`;
            }
            bankaHtml += `<div class="t-row"><div class="t-details"><div class="t-name">${icon} ${b.isim}</div>${kmhDurumu}</div><div class="t-amt ${tutarRengi}">${formatTL(b.bakiye)}</div></div>`;
            
            // MİMAR EKLENTİSİ: Sadece cebindeki ve hesaptaki ARTILARI topla
            if(b.bakiye > 0) {
                toplamLikidite += b.bakiye;
            }
        });

        // MİMAR EKLENTİSİ: Özgüven veren dip toplam satırı
        bankaHtml += `
        <div class="t-row" style="border-top: 1px dashed rgba(255,255,255,0.1); margin-top: 4px; padding: 12px 10px; background: rgba(16, 185, 129, 0.05); border-radius: 8px; display: flex; align-items: center; min-height: 48px;">
            <div class="t-details" style="display: flex; align-items: center; flex: 1;">
                <i class="fas fa-shield-alt" style="color: var(--emerald); font-size: 14px; margin-right: 8px; display: flex; align-items: center;"></i>
                <div style="font-size: 12px; font-weight: 700; color: var(--emerald); line-height: 1;">Kullanılabilir Nakit Gücü</div>
            </div>
            <div class="t-amt" style="font-size: 16px; font-weight: 800; color: var(--emerald); display: flex; align-items: center;">
                ${formatTL(toplamLikidite)}
            </div>
        </div>`;

        bankaList.innerHTML = bankaHtml;
            window.kartlarDetayli = data.kartlarDetayli || [];
            
        const kSecim = document.getElementById('dashboard-kart-secim');
        if (kSecim) {
            let kOptions = `<option value="hepsi">Tüm Kartlar (Özet)</option>`;
            window.kartlarDetayli.forEach((k, idx) => kOptions += `<option value="${idx}">${k.isim}</option>`);
            kSecim.innerHTML = kOptions;
            refreshCustomSelect(kSecim);
            renderKartDurumu();
        }

        window.hesapOptions = '<option value="" disabled selected>Seçiniz...</option>'; 
        window.vadesizOptions = '<option value="" disabled selected>Seçiniz...</option>'; 
        window.hesapTurleri = { "Nakit": "Nakit" };
        let tumBakiyeler = {};
        if (data.bankalar) data.bankalar.forEach(b => tumBakiyeler[b.isim.trim()] = { bakiye: b.bakiye, tur: b.tur });
        if (data.kartlarDetayli) data.kartlarDetayli.forEach(k => tumBakiyeler[k.isim.trim()] = { bakiye: (k.borc * -1), tur: "Kredi Kartı" });
        
        if (data.dinamikKategoriler && data.dinamikKategoriler.aktifHesaplar) {
            data.dinamikKategoriler.aktifHesaplar.forEach(hesapAdi => {
                let temizAd = hesapAdi.trim();
                let b = tumBakiyeler[temizAd] || { bakiye: 0, tur: "Banka Hesabı" };
                let optHtml = `<option value="${temizAd}">${temizAd} (${formatTLTam(b.bakiye)})</option>`;
                window.hesapOptions += optHtml; window.vadesizOptions += optHtml; window.hesapTurleri[temizAd] = b.tur;
            });
        } else {
            if(data.bankalar) data.bankalar.forEach(b => {
                let optHtml = `<option value="${b.isim}">${b.isim} (${formatTLTam(b.bakiye)})</option>`;
                window.hesapOptions += optHtml; window.vadesizOptions += optHtml; window.hesapTurleri[b.isim] = b.tur;
            });
            if(data.kartlarDetayli) data.kartlarDetayli.forEach(k => {
                let optHtml = `<option value="${k.isim}">${k.isim} (${formatTLTam(k.borc * -1)})</option>`;
                window.hesapOptions += optHtml; window.vadesizOptions += optHtml; window.hesapTurleri[k.isim] = "Kredi Kartı";
            });
        }

        // EVRENSEL FAİZ LİSTESİ: Nakit hariç tüm banka hesapları ve kredi kartları listelenir
        window.faizOptions = '<option value="" disabled selected>Seçiniz...</option>';
        
        if (data.bankalar) {
            data.bankalar.forEach(b => {
                // Sadece Nakit olmayanları (Banka/KMH) ekler
                if (b.tur !== "Nakit" && b.isim.toLowerCase().trim() !== "nakit") {
                    window.faizOptions += `<option value="${b.isim}">${b.isim} (Banka/KMH)</option>`;
                }
            });
        }
        
        if (data.kartlarDetayli) {
            // Tüm Kredi Kartlarını ekler
            data.kartlarDetayli.forEach(k => {
                window.faizOptions += `<option value="${k.isim}">${k.isim} (Kredi Kartı)</option>`;
            });
        }

        // YENİ: Kredi ve Özel Borç Filtreleme Motoru
        let krediOptions = `<option value="" disabled selected>Seçiniz...</option>`;
        let ozelOptions = `<option value="" disabled selected>Seçiniz...</option>`;
        
        data.borclarListe.forEach(b => {
            let pwaFormatliBorcTutar = formatTLTam(b.tutar);
            if (b.tur && b.tur.toLowerCase() === "kredi") {
                krediOptions += `<option value="${b.isim}">${b.isim} (Kalan: ${pwaFormatliBorcTutar})</option>`;
            } else if (b.tur && b.tur.toLowerCase() === "özel") {
                ozelOptions += `<option value="${b.isim}">${b.isim} (Kalan: ${pwaFormatliBorcTutar})</option>`;
            }
        });

        const krSecim = document.getElementById('kredi-secim'); if(krSecim) { krSecim.innerHTML = krediOptions; refreshCustomSelect(krSecim); }
        const oSecim = document.getElementById('ozel-secim'); if(oSecim) { oSecim.innerHTML = ozelOptions; refreshCustomSelect(oSecim); }
        const ogSecim = document.getElementById('ozel-guncelle-secim'); if(ogSecim) { ogSecim.innerHTML = ozelOptions; refreshCustomSelect(ogSecim); }
        
        const kyHesap = document.getElementById('kredi-yeni-hesap'); if(kyHesap) { kyHesap.innerHTML = window.hesapOptions; refreshCustomSelect(kyHesap); }
        const koYontem = document.getElementById('kredi-yontem'); if(koYontem) { koYontem.innerHTML = window.hesapOptions; refreshCustomSelect(koYontem); }
        const ooYontem = document.getElementById('ozel-yontem'); if(ooYontem) { ooYontem.innerHTML = window.hesapOptions; refreshCustomSelect(ooYontem); }
        
        let kartIsimleriList = `<option value="">-- Kart Seçin (Güncel Borç) --</option>`;
        window.kartlarDetayli.forEach(k => {
            kartIsimleriList += `<option value="${k.isim}">${k.isim} — (${formatTLTam(k.borc || 0)})</option>`;
        });
        const klSecim = document.getElementById('kl-secim'); if(klSecim) { klSecim.innerHTML = kartIsimleriList; refreshCustomSelect(klSecim); }
        const kegSecim = document.getElementById('keg-secim'); if(kegSecim) { kegSecim.innerHTML = kartIsimleriList; refreshCustomSelect(kegSecim); }
        const kboSecim = document.getElementById('kbo-secim'); if(kboSecim) { kboSecim.innerHTML = kartIsimleriList; refreshCustomSelect(kboSecim); }
        
        let vgOptions = `<option value="">-- Varlık Seçin --</option>`;
        data.varliklarListe.forEach(v => vgOptions += `<option value="${v.isim}">${v.isim} (${formatTLTam(v.deger)})</option>`);
        const vgSecim = document.getElementById('vg-secim'); if(vgSecim) { vgSecim.innerHTML = vgOptions; refreshCustomSelect(vgSecim); }
        const vsSecim = document.getElementById('vs-secim'); if(vsSecim) { vsSecim.innerHTML = vgOptions; refreshCustomSelect(vsSecim); }
        
        const kboYontem = document.getElementById('kbo-yontem'); if(kboYontem) { kboYontem.innerHTML = window.hesapOptions; refreshCustomSelect(kboYontem); }
        const boYontem = document.getElementById('bo-yontem'); if(boYontem) { boYontem.innerHTML = window.hesapOptions; refreshCustomSelect(boYontem); }

                    // --- TRANSFER LİSTELERİNİ DOLDURUR ---
        const tCikis = document.getElementById('t-cikis');
        const tGiris = document.getElementById('t-giris');
        if (tCikis && tGiris) {
            tCikis.innerHTML = window.vadesizOptions;
            tGiris.innerHTML = window.vadesizOptions;
            if(typeof refreshCustomSelect === 'function') {
                refreshCustomSelect(tCikis);
                refreshCustomSelect(tGiris);
            }
        }

                    // --- YENİ: HESAP İŞLEMLERİ LİSTESİNİ DOLDURUR ---
        let hiOptions = `<option value="" disabled selected>-- Hesap Seçin --</option>`;
        if (data.bankalar) {
            data.bankalar.forEach(b => {
                hiOptions += `<option value="${b.isim}">${b.isim} (${formatTLTam(b.bakiye)})</option>`;
            });
        }
        const hiSecim = document.getElementById('hi-hesap-secim');
        if (hiSecim) {
            hiSecim.innerHTML = hiOptions;
            if(typeof refreshCustomSelect === 'function') refreshCustomSelect(hiSecim);
        }

                    // --- YENİ: Kredi Kartı Borç Düzeltme Listesi ---
        let kbdOptions = `<option value="" disabled selected>-- Kart Seçin --</option>`;
        if (data.kartlarDetayli) {
            data.kartlarDetayli.forEach(k => {
                kbdOptions += `<option value="${k.isim}">${k.isim} (${formatTLTam(k.borc)})</option>`;
            });
        }
        const kbdSecim = document.getElementById('kbd-kart-secim');
        if (kbdSecim) { kbdSecim.innerHTML = kbdOptions; if(typeof refreshCustomSelect === 'function') refreshCustomSelect(kbdSecim); }

        const islemListesi = document.getElementById('islem-listesi');
        if (islemListesi) {
            let islemHtml = "";
            let otoLogListesi = (data.dinamikKategoriler && data.dinamikKategoriler.otoLog) ? data.dinamikKategoriler.otoLog : [];
            
            data.sonIslemler.forEach(islem => {
                let hamKalem = islem.kalem || "İsimsiz İşlem";
                let isOtoLog = islem.kategori && islem.kategori !== "-" && otoLogListesi.includes(islem.kategori);
                let altSatirBilgi = islem.tur === 'Gelir' ? (islem.hedef || islem.odeme) : islem.odeme;
                let rotaMetni = ((islem.tur === 'Transfer' || islem.tur === 'Kart Ödemesi' || islem.tur === 'Borç Ödemesi') && islem.hedef) ? `${islem.odeme} ➔ ${islem.hedef}` : altSatirBilgi;

                let amtClass = islem.tur === 'Gelir' ? 'text-green' : (islem.tur === 'Transfer' ? 'text-gray' : 'text-red');
                let sign = islem.tur === 'Gelir' ? '+' : (islem.tur === 'Transfer' ? '' : '-');
                let badgeText = isOtoLog ? islem.kategori : islem.tur;
                let badgeStyle = isOtoLog ? "background: rgba(59, 130, 246, 0.15); color: var(--blue); border: 1px solid rgba(59, 130, 246, 0.2);" : "";
                let badgeClass = isOtoLog ? "" : (islem.tur === 'Gelir' ? 'pill-green' : (islem.tur === 'Transfer' ? 'pill-gray' : 'pill-red'));
                let robotIcon = isOtoLog ? '<i class="fas fa-robot" style="font-size:9px; margin-right:3px;"></i>' : '';
                let kalemGosterim = isOtoLog ? hamKalem : ((islem.kategori && islem.kategori !== "-" && !hamKalem.startsWith(islem.kategori)) ? islem.kategori + " - " + hamKalem : hamKalem);

                islemHtml += `<div class="t-row" style="align-items: center; padding: 12px 10px; border-bottom: 1px solid rgba(255,255,255,0.03);"><div class="t-details" style="flex: 1; min-width: 0; padding-right: 10px;"><div style="font-size: 13px; font-weight: 600; line-height: 1.3; color: #fff;">${kalemGosterim}</div><div style="font-size: 10px; color: var(--text-muted); margin-top: 4px; opacity: 0.7;">${islem.tarih} • ${rotaMetni}</div></div><div class="t-amt ${amtClass}" style="display: flex; flex-direction: column; align-items: flex-end; justify-content: center; flex-shrink: 0; gap: 4px;"><div class="pill-badge ${badgeClass}" style="font-size: 9px; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; font-weight: 700; ${badgeStyle}">${robotIcon}${badgeText}</div><div style="font-size: 14px; font-weight: 800; letter-spacing: -0.3px;">${sign}${formatTL(islem.tutar)}</div></div></div>`;
            });
            islemListesi.innerHTML = islemHtml;
        }

        let v14_safToplam = 0; let v14_safListe = [];
        if (data.buAyIslemler && data.buAyIslemler.length > 0) {
            data.buAyIslemler.forEach(islem => { if (islem.tur === 'Gider') { v14_safToplam += islem.tutar; v14_safListe.push(islem); } });
        }

        const gercekSafHarcama = data.backendSafHarcama || 0;
        const gercekGunlukOrtalama = data.backendGunlukOrtalama || 0;
        const safToplamEl = document.getElementById('saf-gider-toplam');
        const safOrtalamaEl = document.getElementById('saf-gunluk-ortalama');
        if(safToplamEl) safToplamEl.innerHTML = formatTL(gercekSafHarcama);
        if(safOrtalamaEl) safOrtalamaEl.innerHTML = formatTL(gercekGunlukOrtalama) + `<span style="font-size:11px; opacity:0.5; font-weight:500; margin-left:4px;">/gün</span>`;

        // --- MİMAR DOKUNUŞU: Ay Sonu Projeksiyon Motoru (Yeni Tasarıma Uyumlu) ---
        const tahminKutuEl = document.getElementById('saf-ay-sonu-tahmin');
        const tahminRakamEl = document.getElementById('saf-ay-sonu-rakam');
        
        if (tahminKutuEl && tahminRakamEl) {
            const bugun = new Date();
            const buAyKacGun = new Date(bugun.getFullYear(), bugun.getMonth() + 1, 0).getDate();
            const aySonuTahminiTutar = gercekGunlukOrtalama * buAyKacGun;
            
            if (gercekGunlukOrtalama > 0) {
                tahminKutuEl.style.display = 'flex'; // Veri varsa yatay banner olarak göster
                tahminRakamEl.innerHTML = formatTL(aySonuTahminiTutar);
            } else {
                tahminKutuEl.style.display = 'none'; // Henüz harcama yoksa gizle, yer kaplamasın
            }
        }

        const v14_container = document.getElementById('saf-gider-listesi');
        if (v14_container) {
            if (v14_safListe.length === 0) {
                v14_container.innerHTML = `<div style="text-align:center; padding:20px 0; color:var(--text-muted); font-size:13px;">Harcama kaydı bulunamadı.</div>`;
            } else {
                let v14Html = "";
                let otoLogListesi = (data.dinamikKategoriler && data.dinamikKategoriler.otoLog) ? data.dinamikKategoriler.otoLog : [];
                v14_safListe.forEach(islem => {
                    let hamKalem = islem.kalem || "İsimsiz İşlem";
                    let isOtoLog = islem.kategori && islem.kategori !== "-" && otoLogListesi.includes(islem.kategori);
                    let badgeText = isOtoLog ? islem.kategori : (islem.tur || 'Gider');
                    let badgeStyle = isOtoLog ? "background: rgba(59, 130, 246, 0.15); color: var(--blue); border: 1px solid rgba(59, 130, 246, 0.2);" : "";
                    let badgeClass = isOtoLog ? "" : 'pill-red';
                    let robotIcon = isOtoLog ? '<i class="fas fa-robot" style="font-size:9px; margin-right:3px;"></i>' : '';
                    let kalemGosterim = isOtoLog ? hamKalem : ((islem.kategori && islem.kategori !== "-" && !hamKalem.startsWith(islem.kategori)) ? islem.kategori + " - " + hamKalem : hamKalem);

                    v14Html += `<div class="t-row" style="align-items: center; padding: 12px 10px; border-bottom: 1px solid rgba(255,255,255,0.03);"><div class="t-details" style="flex: 1; min-width: 0; padding-right: 10px;"><div style="font-size: 13px; font-weight: 600; line-height: 1.3; color: #fff;">${kalemGosterim}</div><div style="font-size: 10px; color: var(--text-muted); margin-top: 4px; opacity: 0.7;">${islem.tarih} • ${islem.odeme}</div></div><div class="t-amt text-red" style="display: flex; flex-direction: column; align-items: flex-end; justify-content: center; flex-shrink: 0; gap: 4px;"><div class="pill-badge ${badgeClass}" style="font-size: 9px; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; font-weight: 700; ${badgeStyle}">${robotIcon}${badgeText}</div><div style="font-size: 14px; font-weight: 800; letter-spacing: -0.3px;">-${formatTL(islem.tutar)}</div></div></div>`;
                });
                v14_container.innerHTML = v14Html;
            }
        }

        var buAyEkstraCikislar = 0; 
        var nakitAkisiGruplar = {
            "Toplam Gelirler": { toplam: 0, liste: {}, renk: "var(--emerald)" },
            "Nakit Giderler (Banka/Kasa)": { toplam: 0, liste: {}, renk: "var(--rose)" },
            "Toplam Borç Ödemeleri": { toplam: 0, liste: {}, renk: "var(--blue)" }
        };
        var bankaKartIsimleri = (window.kartlarDetayli) ? window.kartlarDetayli.map(k => (k.isim || "").toString().toLowerCase().trim()) : [];

        if (data.buAyIslemler && Array.isArray(data.buAyIslemler)) {
            data.buAyIslemler.forEach(function(islem) {
                var islemKategori = (islem.kategori && islem.kategori !== "-") ? islem.kategori.toString().trim() : "Diğer";
                var hamKalem = (islem.kalem || "").toString().trim() || "İsimsiz İşlem";
                var zenginKalem = ((islem.tur === 'Transfer' || islem.tur === 'Kart Ödemesi' || islem.tur === 'Borç Ödemesi') && islem.hedef) ? `${hamKalem} (${islem.odeme} ➔ ${islem.hedef})` : hamKalem;
                var odemeYontemi = (islem.odeme || "").toString().toLowerCase().trim();

                if (islem.tur === 'Gelir') {
                    nakitAkisiGruplar["Toplam Gelirler"].toplam += islem.tutar;
                    if (!nakitAkisiGruplar["Toplam Gelirler"].liste[islemKategori]) nakitAkisiGruplar["Toplam Gelirler"].liste[islemKategori] = 0;
                    nakitAkisiGruplar["Toplam Gelirler"].liste[islemKategori] += islem.tutar;
                } else if (islem.tur === 'Gider') {
                    if (!bankaKartIsimleri.includes(odemeYontemi)) {
                        nakitAkisiGruplar["Nakit Giderler (Banka/Kasa)"].toplam += islem.tutar;
                        if (!nakitAkisiGruplar["Nakit Giderler (Banka/Kasa)"].liste[islemKategori]) nakitAkisiGruplar["Nakit Giderler (Banka/Kasa)"].liste[islemKategori] = 0;
                        nakitAkisiGruplar["Nakit Giderler (Banka/Kasa)"].liste[islemKategori] += islem.tutar;
                    }
                } else if (islem.tur === 'Kart Ödemesi' || islem.tur === 'Borç Ödemesi') {
                    buAyEkstraCikislar += islem.tutar;
                    nakitAkisiGruplar["Toplam Borç Ödemeleri"].toplam += islem.tutar;
                    if (!nakitAkisiGruplar["Toplam Borç Ödemeleri"].liste[zenginKalem]) nakitAkisiGruplar["Toplam Borç Ödemeleri"].liste[zenginKalem] = 0;
                    nakitAkisiGruplar["Toplam Borç Ödemeleri"].liste[zenginKalem] += islem.tutar;
                }
            });
        }

        var nakitContainer = document.getElementById('nakit-akisi-listesi-container');
        if(nakitContainer) {
            let nakitKapsayiciHtml = ""; var nIdx = 200;
            for (var nBaslik in nakitAkisiGruplar) {
                var nGrup = nakitAkisiGruplar[nBaslik];
                if (nGrup.toplam === 0) continue;
                var isGelir = nBaslik.includes('Gelir'); var isaret = isGelir ? '+' : '-';
                var yaziRenk = isGelir ? 'text-green' : (nBaslik.includes('Borç') ? 'text-blue' : 'text-red');
                var nHtml = `<div class="sub-accordion-header" onclick="toggleSubAccordion('${nIdx}')"><div style="font-size: 13px; font-weight: 600; color: #e2e8f0; display:flex; align-items:center;"><svg id="sub-icon-${nIdx}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; color:var(--text-muted); transition: transform 0.3s ease;"><polyline points="9 18 15 12 9 6"></polyline></svg>${nBaslik}</div><div style="text-align:right;"><span style="font-size:13px; color:${nGrup.renk}; font-weight:700;">${isaret}${formatTL(nGrup.toplam)}</span></div></div><div class="sub-accordion-content" id="sub-content-${nIdx}">`;
                
                var siraliKategoriler = Object.keys(nGrup.liste).sort((a, b) => nGrup.liste[b] - nGrup.liste[a]);
                siraliKategoriler.forEach(function(isim) {
                    let anaIsim = isim; let altSatir = "";
                    if (isim.includes("➔")) { let parcalar = isim.split("("); anaIsim = parcalar[0].trim(); altSatir = parcalar[1] ? parcalar[1].replace(")", "").trim() : ""; }
                    let kalemHtml = `<div style="font-size: 13px; color: var(--text-muted); font-weight: 600; line-height: 1.2;">${anaIsim}</div>`;
                    if (altSatir !== "") kalemHtml += `<div style="font-size: 10px; color: rgba(255,255,255,0.3); font-weight: 400; margin-top: 3px; display: flex; align-items: center;">${altSatir}</div>`;
                    nHtml += `<div class="t-row" style="align-items: flex-start; padding: 12px 10px; border-bottom: 1px dashed rgba(255,255,255,0.05);"><div class="t-name" style="flex: 1; min-width: 0;">${kalemHtml}</div><div class="t-amt ${yaziRenk}" style="text-align: right; flex-shrink: 0; margin-left: 10px; font-size: 13px; font-weight: 700;">${isaret}${formatTL(nGrup.liste[isim])}</div></div>`;
                });
                nakitKapsayiciHtml += nHtml + `</div>`; nIdx++;
            }
            nakitContainer.innerHTML = nakitKapsayiciHtml;
        }
        
        var netAkis = data.backendNetNakit || 0;
        const sumNetNakit = document.getElementById('summary-net-nakit');
        if (sumNetNakit) { sumNetNakit.innerHTML = formatTL(netAkis); sumNetNakit.style.color = netAkis < 0 ? 'var(--rose)' : 'var(--emerald)'; }

        animateValue('val-buay-borc-odeme', buAyEkstraCikislar, aSure);
        window.currentStats.safHarcama = gercekSafHarcama || 0;
        window.currentStats.gunlukOrt = gercekGunlukOrtalama || 0;
        window.currentStats.netKalan = netAkis || 0;
        animateValue('val-nakit-giris', nakitAkisiGruplar["Toplam Gelirler"].toplam, aSure);
        animateValue('val-nakit-cikis', (nakitAkisiGruplar["Nakit Giderler (Banka/Kasa)"].toplam + nakitAkisiGruplar["Toplam Borç Ödemeleri"].toplam), aSure);
        animateValue('val-net-nakit', netAkis, aSure);

                // 1. Kutu Rengini Ayarla (Sadece BİR KERE tanımlıyoruz)
        const kutuNet = document.getElementById('kutu-net-nakit'); 
        const valNet = document.getElementById('val-net-nakit');
        if (kutuNet && valNet) {
            if (netAkis < 0) {
                kutuNet.style.background = 'rgba(244, 63, 94, 0.1)'; 
                kutuNet.style.borderColor = 'rgba(244, 63, 94, 0.3)'; 
                valNet.style.color = 'var(--rose)';
            } else {
                kutuNet.style.background = 'rgba(16, 185, 129, 0.1)'; 
                kutuNet.style.borderColor = 'rgba(16, 185, 129, 0.3)'; 
                valNet.style.color = 'var(--emerald)';
            }
        }

                // 2. Akıllı Tüketim Barı Motoru
        try {
            const tuketimKapsayici = document.getElementById('tuketim-bari-kapsayici');
            const tuketimYuzdeEl = document.getElementById('tuketim-yuzdesi');
            const tuketimBarDoluluk = document.getElementById('tuketim-bari-doluluk');
            
            if (tuketimKapsayici && tuketimYuzdeEl && tuketimBarDoluluk) {
                let toplamGelir = nakitAkisiGruplar["Toplam Gelirler"].toplam || 0;
                let toplamGider = (nakitAkisiGruplar["Nakit Giderler (Banka/Kasa)"].toplam || 0) + (nakitAkisiGruplar["Toplam Borç Ödemeleri"].toplam || 0);
                
                // MİMAR KURALI: Bar gelir olsun olmasın HER ZAMAN görünür olacak!
                tuketimKapsayici.style.display = 'block'; 
                
                if (toplamGelir > 0) {
                    let yuzdeHesap = (toplamGider / toplamGelir) * 100;
                    let barYuzdesi = Math.min(yuzdeHesap, 100); 
                    
                    setTimeout(() => {
                        tuketimBarDoluluk.style.width = barYuzdesi + '%';
                        if (yuzdeHesap >= 90) {
                            tuketimBarDoluluk.style.backgroundColor = 'var(--rose)';
                            tuketimYuzdeEl.style.color = 'var(--rose)';
                        } else if (yuzdeHesap >= 75) {
                            tuketimBarDoluluk.style.backgroundColor = 'var(--amber)';
                            tuketimYuzdeEl.style.color = 'var(--amber)';
                        } else {
                            tuketimBarDoluluk.style.backgroundColor = 'var(--emerald)';
                            tuketimYuzdeEl.style.color = 'var(--text-muted)';
                        }
                        tuketimYuzdeEl.innerText = '%' + yuzdeHesap.toFixed(0);
                    }, 100); 
                } else {
                    // EĞER HENÜZ GELİR GİRİLMEDİYSE: Bar gizlenmez, boş bekler.
                    setTimeout(() => {
                        tuketimBarDoluluk.style.width = '0%';
                        tuketimYuzdeEl.innerText = 'Gelir Bekleniyor';
                        tuketimYuzdeEl.style.color = 'var(--text-muted)';
                    }, 100);
                }
            }
        } catch (e) {
            console.error("Bar cizim hatasi:", e);
        }

        const sKategoriContainer = document.getElementById('sabitler-kategori-container');
        let sOdenenGider = 0; let sKalanGider = 0; let sGruplar = {}; let sKategoriHtml = "";
        data.tumSabitlerListe.forEach(s => {
            if(s.yon === "Gider" || s.yon === "Borç Ödemesi") {
                if(!sGruplar[s.tur]) sGruplar[s.tur] = { odendi: 0, kalan: 0, liste: [] };
                if(s.odendiMi) { sGruplar[s.tur].odendi += s.tutar; sOdenenGider += s.tutar; }
                else { sGruplar[s.tur].kalan += s.tutar; sKalanGider += s.tutar; }
                sGruplar[s.tur].liste.push(s);
            }
        });
        
        let globalSira = 0;
        
        // EVRENSEL SIRALAMA ZIRHI: Eski yapıyı bozmadan verileri büyükten küçüğe dizer
        let siraliTurler = Object.keys(sGruplar).sort((a, b) => {
            let topA = (sGruplar[a].odendi || 0) + (sGruplar[a].kalan || 0);
            let topB = (sGruplar[b].odendi || 0) + (sGruplar[b].kalan || 0);
            return topB - topA;
        });
        let siraliGruplar = {};
        siraliTurler.forEach(t => { siraliGruplar[t] = sGruplar[t]; });

                for (let tur in siraliGruplar) {
            let g = siraliGruplar[tur]; let kategoriOdendiMi = (g.kalan === 0);
            let modernTik = kategoriOdendiMi ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--emerald)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px; flex-shrink:0;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>` : '';
            let html = `<div class="sub-accordion-header" onclick="toggleSubAccordion('${globalSira}')"><div style="font-size: 14px; font-weight: 600; color: #e2e8f0; display:flex; align-items:center;"><svg id="sub-icon-${globalSira}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; color:var(--text-muted); transition: transform 0.3s ease;"><polyline points="9 18 15 12 9 6"></polyline></svg>${modernTik}${tur}</div><div style="text-align:right; display:flex; align-items:center; justify-content:flex-end; gap:4px;"><span style="font-size:13px; font-weight:800; color:${g.kalan === 0 ? 'var(--emerald)' : 'var(--amber)'}; letter-spacing: -0.2px;">${formatTL(g.odendi||0)}</span><span style="font-size:11px; color:var(--text-muted); font-weight:600;"> / ${formatTL((g.odendi||0) + (g.kalan||0))}</span></div></div><div class="sub-accordion-content" id="sub-content-${globalSira}">`;
            g.liste.forEach(s => {
                let durumIcon = s.odendiMi ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--emerald)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>` : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
                let op = s.odendiMi ? 'opacity: 0.6;' : 'opacity: 1;'; let tClass = s.odendiMi ? 'text-gray' : 'text-red';
                html += `<div class="t-row" style="${op} padding: 12px 10px; border-bottom: 1px dashed rgba(255,255,255,0.05);"><div style="margin-right: 12px; display:flex; align-items:center;">${durumIcon}</div><div class="t-details"><div class="t-name" style="font-size:13px; display:flex; align-items:center; flex-wrap:wrap;">${s.kalem}${getKalanAyBadge(s.kalanAy)}</div><div class="t-meta" style="font-size:10px;">Ayın ${s.gun}. Günü • ${s.yontem}</div></div><div class="t-amt ${tClass}" style="font-size:14px;">${formatTL(s.tutar)}</div></div>`;
            });
            sKategoriHtml += html + `</div>`; globalSira++;
        }
                    sKategoriHtml += `
        <div style="margin-top:15px; display:flex; gap:10px;">
            <button onclick="if(!document.getElementById('action-modal').classList.contains('active')) toggleModal(); showSection('section-duzenli', '📅 Yeni Düzenli Kayıt');" style="flex:1; height:36px; background:rgba(16, 185, 129, 0.1); border:1px solid rgba(16, 185, 129, 0.3); color:var(--emerald); border-radius:10px; font-size:11px; font-weight:800; cursor:pointer;">
                <i class="fas fa-plus"></i> YENİ EKLE
            </button>
            <button onclick="this.style.pointerEvents='none'; loadSabitlerAndShow('section-sabit-guncelle', 'sg-kural', 'Düzenli Kayıtları Yönet').then(() => { const m=document.getElementById('action-modal'); const b=document.getElementById('fab-btn'); m.classList.add('active'); b.classList.add('open'); document.body.classList.add('modal-open'); this.style.pointerEvents='auto'; });" style="flex:1; height:36px; background:rgba(59, 130, 246, 0.1); border:1px solid rgba(59, 130, 246, 0.3); color:var(--blue); border-radius:10px; font-size:11px; font-weight:800; cursor:pointer;">
                <i class="fas fa-pen-to-square"></i> GÜNCELLE
            </button>
        </div>`;
        sKategoriContainer.innerHTML = sKategoriHtml;

                document.getElementById('sabit-genel-toplam').innerHTML = formatTL(sOdenenGider + sKalanGider);
        document.getElementById('sabit-odenen-toplam').innerHTML = formatTL(sOdenenGider);
        
        // --- MİMAR DOKUNUŞU: Aylık Yük Erime Barı Hesaplaması ---
        let genelTop = sOdenenGider + sKalanGider;
        let tamYuzde = genelTop > 0 ? (sOdenenGider / genelTop) * 100 : 0;
        
        const barEl = document.getElementById('sabit-tamamlanma-bar');
        const yuzdeEl = document.getElementById('sabit-tamamlanma-yuzde');
        if (barEl && yuzdeEl) {
            setTimeout(() => {
                barEl.style.width = tamYuzde + '%';
                yuzdeEl.innerText = '%' + tamYuzde.toFixed(0);
                if (tamYuzde === 100) {
                    barEl.style.backgroundColor = 'var(--emerald)';
                    yuzdeEl.style.color = 'var(--emerald)';
                } else {
                    barEl.style.backgroundColor = 'var(--blue)'; 
                    yuzdeEl.style.color = 'var(--text-muted)';
                }
            }, 100);
        }

        // EVRENSEL SIFIR BORÇ MOTİVASYON MOTORU
        const kalanKutu = document.getElementById('sabit-kalan-toplam');
        if (sKalanGider === 0 && genelTop > 0) {
            kalanKutu.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px; vertical-align:-3px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>TAMAMLANDI`;
            kalanKutu.style.color = "var(--emerald)"; 
        } else {
            kalanKutu.innerHTML = formatTL(sKalanGider);
            kalanKutu.style.color = "var(--rose)"; 
        }

                const yListe = document.getElementById('yaklasan-listesi');
        if (data.yaklasanOdemeler.length > 0) {
            let yHtml = "";
            
            // --- KUSURSUZ ZIRH: Ana veriyi bozmamak için kopyasını (klonunu) alıp sadece burada sıralıyoruz ---
            const bugunGunu = new Date().getDate();
            const buAyKacGun = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
            
            // [...data] yazarak ana veriden bağımsız yeni bir liste yaratıyoruz
            let siraliYaklasanlar = [...data.yaklasanOdemeler].sort((a, b) => {
                let farkA = a.gun - bugunGunu;
                if (farkA < 0) farkA += buAyKacGun; // Ay geçişi koruması (Örn: 28'den 2'sine)
                
                let farkB = b.gun - bugunGunu;
                if (farkB < 0) farkB += buAyKacGun; 
                
                return farkA - farkB;
            });
            // ------------------------------------------------------------------------------------------------

                            siraliYaklasanlar.forEach(y => {
                const otoLogListesi = (data.dinamikKategoriler && data.dinamikKategoriler.otoLog) ? data.dinamikKategoriler.otoLog : [];
                const isOtomatik = otoLogListesi.includes(y.tur);

                const kategoriMetni = (y.tur && y.tur !== "-" && !y.kalem.startsWith(y.tur)) 
                    ? `<span style="opacity:0.85; font-weight:500;">${y.tur}</span>&nbsp;-&nbsp;` 
                    : "";

                const badge = isOtomatik 
                    ? `<span style="font-size:9px; background:rgba(59, 130, 246, 0.15); color:#60a5fa; padding:2px 6px; border-radius:4px; border:1px solid rgba(59, 130, 246, 0.3); font-weight:800; display:inline-flex; align-items:center;"><i class="fas fa-robot" style="margin-right:3px;"></i>OTOMATİK</span>`
                    : `<button onclick="this.style.pointerEvents='none'; loadSabitlerAndShow('section-sabit-onayla', 'so-kural', 'Bekleyen İşlemi Onayla').then(() => { const m=document.getElementById('action-modal'); const b=document.getElementById('fab-btn'); if(!m.classList.contains('active')) { m.classList.add('active'); b.classList.add('open'); document.body.classList.add('modal-open'); } this.style.pointerEvents='auto'; }); event.stopPropagation();" style="border:none; cursor:pointer; min-width:64px; height:22px; font-size:9px; background:rgba(245, 158, 11, 0.2); color:#fbbf24; padding:0 8px; border-radius:6px; border:1px solid rgba(245, 158, 11, 0.4); font-weight:900; display:inline-flex; align-items:center; justify-content:center; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">ONAYLA</button>`;

                // --- MİMAR DOKUNUŞU: Zaman Sensörü ve "Nabız" (Pulse) Efekti ---
                let fark = y.gun - bugunGunu;
                if (fark < 0) fark += buAyKacGun; // Ay devretme koruması

                let geriSayimBadge = "";
                let rowStyleEk = "";
                
                                if (fark === 0) {
                    // BUGÜN: Mimar Dokunuşu - Tüm satır kırmızıya çalar ve nabız gibi yanıp söner
                    geriSayimBadge = `<span style="font-size:9px; background:rgba(244, 63, 94, 0.15); color:var(--rose); padding:2px 6px; border-radius:4px; font-weight:800; border:1px solid rgba(244, 63, 94, 0.3); margin-left:6px;"><i class="fas fa-exclamation-triangle" style="margin-right:3px;"></i>BUGÜN</span>`;
                    
                    // Satıra eklenecek animasyon stili
                    rowStyleEk = `border-color: rgba(244, 63, 94, 0.6); animation: sirenPulse 1.2s infinite;`;
                    
                    if (!document.getElementById('siren-pulse-style')) {
                        const s = document.createElement('style'); s.id = 'siren-pulse-style';
                        // Hem arka plan rengi kızarır hem de dışarıya hafif kırmızı bir ışık yayar
                        s.innerHTML = `@keyframes sirenPulse { 
                            0% { background-color: rgba(244, 63, 94, 0.05); box-shadow: 0 0 0px rgba(244,63,94,0); } 
                            50% { background-color: rgba(244, 63, 94, 0.3); box-shadow: 0 0 12px rgba(244,63,94,0.5); } 
                            100% { background-color: rgba(244, 63, 94, 0.05); box-shadow: 0 0 0px rgba(244,63,94,0); } 
                        }`;
                        document.head.appendChild(s);
                    }
                } else if (fark === 1) {
                    // YARIN: Satır turuncu (amber) olur
                    geriSayimBadge = `<span style="font-size:9px; background:rgba(245, 158, 11, 0.15); color:var(--amber); padding:2px 6px; border-radius:4px; font-weight:800; border:1px solid rgba(245, 158, 11, 0.3); margin-left:6px;"><i class="fas fa-clock" style="margin-right:3px;"></i>YARIN</span>`;
                    rowStyleEk = `background: rgba(245, 158, 11, 0.08); border-color: rgba(245, 158, 11, 0.3);`;
                } else {
                    // DİĞER GÜNLER: Klasik görünüm, sadece gün sayar
                    geriSayimBadge = `<span style="font-size:9px; background:rgba(255, 255, 255, 0.05); color:var(--text-muted); padding:2px 6px; border-radius:4px; font-weight:700; border:1px solid rgba(255, 255, 255, 0.1); margin-left:6px;">${fark} GÜN KALDI</span>`;
                    rowStyleEk = `background: rgba(245, 158, 11, 0.03); border-color: rgba(245, 158, 11, 0.15);`;
                }

                // YENİ TASARIM
                yHtml += `
                <div class="t-row" style="padding: 14px 12px; border-radius: 12px; margin-bottom: 8px; border: 1px dashed; align-items: center; transition: 0.3s; ${rowStyleEk}">
                    <div class="t-details" style="flex: 1; display: flex; flex-direction: column; gap: 7px;">
                        <div style="font-size: 14px; color: #fff; font-weight:700; line-height:1.2; word-break: break-word;">
                            ${kategoriMetni}${y.kalem}
                        </div>
                        
                        <div style="display: flex; align-items: center; flex-wrap: wrap;">
                            ${badge}${geriSayimBadge}
                        </div>
                        
                        <div style="font-size: 10px; color:rgba(255,255,255,0.4); font-weight:500;">
                            Ayın ${y.gun}. Günü • ${y.yontem}
                        </div>
                    </div>
                    
                    <div class="t-amt text-red" style="font-size: 16px; font-weight: 800; margin-left:10px; flex-shrink: 0;">
                        ${formatTL(y.tutar)}
                    </div>
                </div>`;
            });

            // --- MANTIK KORUNDU: Toplam Satırı ---
            yHtml += `
            <div class="t-row" style="border-top: 1px dashed rgba(255,255,255,0.2); margin-top: 10px; padding-top: 12px; padding-right: 4px; display:flex; justify-content:flex-end; align-items:center;">
                <div style="font-weight: 800; text-align: right; color: var(--text-muted); margin-right:10px; font-size:13px;">7 Günlük Toplam:</div>
                <div class="t-amt text-red" style="font-size: 18px; font-weight: 900;">${formatTL(data.yaklasanToplam)}</div>
            </div>`;
            
            yListe.innerHTML = yHtml;
        } else {
            yListe.innerHTML = `<div style="text-align:center; color:var(--text-muted); font-size: 14px; padding: 10px 0;"><i class="fas fa-check-circle" style="color:var(--emerald); font-size:24px; display:block; margin-bottom:10px;"></i>Önümüzdeki 7 gün için bekleyen ödeme yok.</div>`;
        }

        const krediListe = document.getElementById('kredi-ilerleme-container');
        if (data.ilerlemeBarlari && data.ilerlemeBarlari.length > 0) {
            let krHtml = "";
            data.ilerlemeBarlari.forEach(kb => {
                krHtml += `
                <div style="margin-bottom: 16px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                        <span style="font-size:13px; font-weight:600; color:#e2e8f0; display:flex; align-items:center; flex-wrap:wrap;">
                            ${kb.isim}${getKalanAyBadge(kb.vade)}
                        </span>
                        <span style="font-size:13px; font-weight:800; color:var(--blue);">%${kb.yuzde}</span>
                    </div>
                    <div class="progress-container" style="height:8px; background:rgba(0,0,0,0.3);">
                        <div class="progress-bar" style="width:${kb.yuzde}%; background:var(--blue); box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);"></div>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-top:6px; font-size:11px; color:var(--text-muted);">
                        <span>Kalan: ${formatTLTam(kb.kalanTutar)}</span>
                        <span>Başlangıç: ${formatTLTam(kb.baslangicTutar)}</span>
                    </div>
                </div>`;
            });
                        krHtml += `
        <div style="margin-top:15px; padding-top:10px; border-top:1px dashed rgba(255,255,255,0.1);">
            <button onclick="this.style.pointerEvents='none'; loadSabitlerAndShow('section-sabit-onayla', 'so-kural', 'Kredi Taksidi Onayla').then(() => { const m=document.getElementById('action-modal'); const b=document.getElementById('fab-btn'); m.classList.add('active'); b.classList.add('open'); document.body.classList.add('modal-open'); this.style.pointerEvents='auto'; });" style="width:100%; height:36px; background:rgba(245, 158, 11, 0.15); border:1px solid rgba(245, 158, 11, 0.3); color:var(--amber); border-radius:10px; font-size:12px; font-weight:800; cursor:pointer;">
                <i class="fas fa-landmark"></i> KREDİ ÖDE
            </button>
        </div>`;
            krediListe.innerHTML = krHtml;
        } else {
            krediListe.innerHTML = `<div style="text-align:center; color:var(--text-muted); font-size: 13px; padding: 10px 0;">Aktif kredi ilerlemesi bulunamadı.</div>`;
        }

                const ctxPasta = document.getElementById('expenseChart');
        if (ctxPasta) {
            const cCtx = ctxPasta.getContext('2d');
            let pastaData = {}; 
            let pastaSafToplam = 0;

            // --- 1. VERİ TOPLAMA VE GRUPLAMA (DİLİMLER İÇİN) ---
            if (data.buAyIslemler && data.buAyIslemler.length > 0) {
                data.buAyIslemler.forEach(islem => {
                    if (islem.tur === 'Gider') { 
                        // KRİTİK: Dilimler artık Kalem(E) değil, Kategori(C) bazlı oluşuyor
                        let kat = islem.kategori || "Diğer";
                        if (kat.toLowerCase().includes("faiz")) kat = "Toplam Faiz Gideri";
                        
                        pastaData[kat] = (pastaData[kat] || 0) + islem.tutar;
                        pastaSafToplam += islem.tutar;
                    }
                });
            }

            // ÖNEMLİ: Grafik varsa önce yok et (İki kere üst üste çizilmesini engeller)
            if (expenseChartInstance) expenseChartInstance.destroy();

            // Kategorileri tutara göre büyükten küçüğe sırala
            const sortedPastaKategoriler = Object.entries(pastaData).sort((a, b) => b[1] - a[1]);
            let labels = []; 
            let values = []; 
            let digerToplam = 0;

            sortedPastaKategoriler.forEach((item, index) => {
                if (index < 5) { labels.push(item[0]); values.push(item[1]); } else { digerToplam += item[1]; }
            });
            if (digerToplam > 0) { labels.push("Diğer"); values.push(digerToplam); }

            // --- 2. AY BAŞI KONTROLÜ VE GRAFİK ÇİZİMİ ---
            if (values.length > 0) {
                const premiumColors = ['#f43f5e', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#64748b'];
                try {
                    expenseChartInstance = new Chart(cCtx, {
                        type: 'doughnut',
                        data: {
                            labels: labels,
                            datasets: [{ 
                                data: values, 
                                backgroundColor: labels.map((label, index) => label === "Diğer" ? '#64748b' : premiumColors[index]), 
                                borderWidth: 0, 
                                hoverOffset: 12 
                            }]
                        },
                        options: {
                            responsive: true, 
                            maintainAspectRatio: false, 
                            cutout: '75%', 
                            plugins: {
                                legend: { display: false }, 
                                tooltip: { enabled: false } // Siyah kutu çakışmasını önler
                            },
                            // --- DİNAMİK MERKEZ YAZIM MANTIĞI ---
                            onHover: (event, chartElement) => {
                                const mBaslik = document.getElementById('pasta-merkez-baslik');
                                const mDeger = document.getElementById('pasta-toplam-rakam');
                                if(!mBaslik || !mDeger) return;

                                if (chartElement.length > 0) {
                                    const index = chartElement[0].index;
                                    const label = labels[index];
                                    const val = values[index];
                                    const yuzde = pastaSafToplam > 0 ? ((val / pastaSafToplam) * 100).toFixed(1) : 0;
                                    
                                    mBaslik.innerText = label.toUpperCase() + " (%" + yuzde + ")";
                                    mBaslik.style.color = "var(--amber)"; 
                                    mDeger.innerHTML = formatTL(val); 
                                } else {
                                    mBaslik.innerText = "SAF HARCAMA";
                                    mBaslik.style.color = "var(--text-muted)";
                                    mDeger.innerHTML = formatTL(pastaSafToplam); 
                                }
                            }
                        }
                    });
                } catch(e) { console.error("Grafik çizim hatası:", e); }

                // İlk açılışta merkezi doldur
                const pastaToplamEl = document.getElementById('pasta-toplam-rakam'); 
                if(pastaToplamEl) pastaToplamEl.innerHTML = formatTL(pastaSafToplam);

                                // --- 3. ALTTAKİ TOP 5 LİSTESİ (KATEGORİ - AÇIKLAMA) VE ISI HARİTASI ---
                const top5Container = document.getElementById('pasta-ozet-grid');
                if (top5Container) {
                    let top5Html = "";
                    
                    // MİMAR DOKUNUŞU: Artık tekil fişleri değil, doğrudan Pasta Grafiğindeki KATEGORİLERİ (labels/values) çekiyoruz.
                    // En yüksek kategori tutarını (1. sıradakini) Isı Haritası referansı için alıyoruz
                    let maxTutar = values.length > 0 ? values[0] : 0;

                    labels.forEach((kategoriAdi, index) => {
                        const tutar = values[index]; 
                        const pay = pastaSafToplam > 0 ? ((tutar / pastaSafToplam) * 100).toFixed(1) : 0;
                        
                        // Isı Haritası Bar Genişliği (1. Kategori %100, diğerleri ona göre oranlanır)
                        const isiYuzdesi = maxTutar > 0 ? (tutar / maxTutar) * 100 : 0;
                        
                        top5Html += `
                        <div class="t-row" style="position: relative; padding: 10px 8px; border-bottom: 1px dashed rgba(255,255,255,0.05); align-items: center; border-radius: 8px; overflow: hidden; margin-bottom: 4px;">
                            
                            <div style="position: absolute; top: 0; left: 0; height: 100%; width: ${isiYuzdesi}%; background: linear-gradient(90deg, rgba(244, 63, 94, 0.15) 0%, rgba(244, 63, 94, 0.05) 100%); z-index: 0; border-right: 1px solid rgba(244, 63, 94, 0.3); transition: width 1s ease-out;"></div>
                            
                            <div class="t-details" style="flex: 1; z-index: 1; position: relative;">
                                <div class="t-name" style="font-size: 13px; color: #cbd5e1;">
                                    <span style="color: var(--text-muted); margin-right: 4px; font-weight: 400;">${index + 1}.</span> ${kategoriAdi}
                                </div>
                            </div>
                            <div class="t-amt" style="text-align: right; z-index: 1; position: relative;">
                                <div class="text-red" style="font-size: 14px; font-weight: 700;">${formatTL(tutar)}</div>
                                <div style="font-size: 10px; color: var(--text-muted); font-weight: 600;">%${pay}</div>
                            </div>
                        </div>`;
                    });
                    top5Container.innerHTML = top5Html;
                }
            } else {
                // AY BAŞI KORUMASI: Hiç veri yoksa temizle ve placeholder yaz
                cCtx.clearRect(0,0,ctxPasta.width,ctxPasta.height); 
                cCtx.font = "13px Inter"; 
                cCtx.fillStyle = "#94a3b8"; 
                cCtx.textAlign = "center"; 
                cCtx.fillText("Bu ay henüz saf harcama yok", ctxPasta.canvas.width/2, ctxPasta.canvas.height/2);
                const pastaToplamEl = document.getElementById('pasta-toplam-rakam');
                if(pastaToplamEl) pastaToplamEl.innerHTML = formatTL(0);
                const t5C = document.getElementById('pasta-ozet-grid');
                if(t5C) t5C.innerHTML = "";
            }
        }
        
        // Header tarihini her zaman güncelle
        const simdi = new Date();
        const formatliTarih = `${simdi.getDate()} ${simdi.toLocaleString('tr-TR', { month: 'long' })} ${simdi.getFullYear()}, ${gunler[simdi.getDay()]}`;
        const headDateEl = document.getElementById('header-date');
        if(headDateEl) headDateEl.innerText = formatliTarih;
    }


        async function verileriCek() {
        const durumEl = document.getElementById('baglanti-durumu');
        const hayaletVeri = localStorage.getItem('hayalet_veri');

        if (hayaletVeri) {
            try {
                const eskiData = JSON.parse(hayaletVeri);
                ekraniCiz(eskiData, true); 
                durumEl.innerHTML = `<span class="spinner"></span>Senkronize ediliyor...`;
                durumEl.style.color = "var(--amber)";
            } catch(e) {
                console.error("Hafıza okuma hatası", e);
                durumEl.innerHTML = `<span class="spinner"></span>Bağlanıyor...`;
                durumEl.style.color = "var(--amber)";
            }
        } else {
            durumEl.innerHTML = `<span class="spinner"></span>Bağlanıyor...`;
            durumEl.style.color = "var(--amber)";
        }

        try {
            const res = await fetch(API_URL);
            const textResponse = await res.text(); // JSON yerine text olarak al, hata kontrolü için
            
            // Eğer dönen yanıt HTML (hata sayfası) ise sistemi çökertme
            if (textResponse.includes("<html") || textResponse.includes("<body")) {
                throw new Error("Backend'den JSON yerine HTML (Hata Sayfası) döndü.");
            }

            const data = JSON.parse(textResponse);
            
            localStorage.setItem('hayalet_veri', JSON.stringify(data));
            ekraniCiz(data, !hayaletVeri); 
            
            const simdi = new Date();
            const saatDak = String(simdi.getHours()).padStart(2, '0') + ':' + String(simdi.getMinutes()).padStart(2, '0');
            document.getElementById('last-update').innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px; vertical-align:middle;"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>${saatDak}`;
            durumEl.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px; vertical-align:middle;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Senkronize`;
            durumEl.style.color = "var(--emerald)";

        } catch (error) {
            durumEl.innerHTML = `ÇEVRİMDIŞI`;
            durumEl.style.color = "var(--rose)";
            console.error("Kritik Fetch Hatası (Backend Çöktü!):", error);
        }
    }

    function renderKartDurumu() {
        if (!window.kartlarDetayli || window.kartlarDetayli.length === 0) return;
        const sel = document.getElementById('dashboard-kart-secim');
        if (!sel) return;
        
        const val = sel.value;
        const trendKartEl = document.getElementById('trend-kart');
        if (trendKartEl) {
      // Eğer seçim 'hepsi' (Tüm Kartlar) ise göster, değilse gizle
      trendKartEl.style.display = (val === 'hepsi') ? 'block' : 'none';
  }
        let cKullanilabilir = 0, cLimit = 0, cBorc = 0, cDonemIci = 0, cGelecek = 0;
        
        if (val === 'hepsi') {
            window.kartlarDetayli.forEach(k => { cLimit += k.limit; cBorc += k.borc; cDonemIci += k.donemIci; cGelecek += k.gelecek; });
            document.getElementById('val-kart-puan').style.display = 'none';
        } else {
            const k = window.kartlarDetayli[val];
            if (!k) return;
            cLimit = k.limit; cBorc = k.borc; cDonemIci = k.donemIci; cGelecek = k.gelecek;
            document.getElementById('val-kart-puan').innerText = formatTLTam(k.puan) + ' Puan';
            document.getElementById('val-kart-puan').style.display = k.puan > 0 ? 'inline-block' : 'none';
        }
        
        cKullanilabilir = Math.max(0, cLimit - cBorc);
        let doluluk = cLimit > 0 ? Math.round((cBorc / cLimit) * 100) : 0;
        
        animateValue('val-kart-kullanilabilir', cKullanilabilir, 600);
        animateValue('val-kart-limit', cLimit, 600);
        animateValue('val-kart-toplam', cBorc, 600);
        animateValue('val-kart-donemici', cDonemIci, 600);
        animateValue('val-kart-gelecek', cGelecek, 600);
        
                document.getElementById('bar-kart-limit').style.width = doluluk + '%';
        const dBadge = document.getElementById('val-kart-doluluk');
        
        // --- MİMAR DOKUNUŞU: Kritik Limit Animasyonu ---
        
        // Önce CSS animasyonunu bir kere sayfaya enjekte edelim (Yoksa ekle)
        if (!document.getElementById('pulse-anim-style')) {
            const style = document.createElement('style');
            style.id = 'pulse-anim-style';
            style.innerHTML = `@keyframes criticalPulse { 0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(244, 63, 94, 0.4); } 70% { transform: scale(1.05); box-shadow: 0 0 0 6px rgba(244, 63, 94, 0); } 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(244, 63, 94, 0); } }`;
            document.head.appendChild(style);
        }

        // Animasyonu varsayılan olarak temizle
        dBadge.style.animation = "none";
        dBadge.style.border = "none";

        if (doluluk >= 90) { // %90 ve üzeri KRİTİK ALARM
            dBadge.innerText = `KRİTİK LİMİT (%${doluluk})`;
            dBadge.style.background = 'rgba(244, 63, 94, 0.2)'; 
            dBadge.style.color = 'var(--rose)';
            dBadge.style.border = '1px solid rgba(244, 63, 94, 0.5)';
            dBadge.style.animation = "criticalPulse 1.5s infinite";
        } else if (doluluk >= 75) { // %75 - %89 arası SARI UYARI
            dBadge.innerText = '%' + doluluk + ' Dolu';
            dBadge.style.background = 'rgba(245, 158, 11, 0.15)'; 
            dBadge.style.color = 'var(--amber)';
        } else { // %75 altı GÜVENLİ BÖLGE
            dBadge.innerText = '%' + doluluk + ' Dolu';
            dBadge.style.background = 'rgba(16, 185, 129, 0.15)'; 
            dBadge.style.color = 'var(--emerald)';
        }
    }

    function toggleSubAccordion(id) {
        vibe();
        const content = document.getElementById(`sub-content-${id}`);
        const icon = document.getElementById(`sub-icon-${id}`);
        if (content) {
            content.classList.toggle('open');
            if (icon) {
                icon.style.transform = content.classList.contains('open') ? 'rotate(90deg)' : 'rotate(0deg)';
            }
        }
    }

    const formInputs = document.querySelectorAll('input.form-control');
    formInputs.forEach(input => {
        input.addEventListener('focus', () => {
            formInputs.forEach(otherInput => {
                if (otherInput !== input) otherInput.setAttribute('tabindex', '-1');
            });
        });
        input.addEventListener('blur', () => {
            formInputs.forEach(otherInput => {
                otherInput.removeAttribute('tabindex');
            });
        });
    });

    // 3. Ekranda Boşluğa veya Aşağı/Yukarı Kaydırınca Klavyeyi Gizleme
    document.addEventListener('touchmove', function(e) {
        if(document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
            document.activeElement.blur();
        }
    }, {passive: true});

    // ----------------------------------------------

// =========================================================================
// 🌟 HESAP İŞLEMLERİ (BAKİYE EŞİTLEME & KMH GÜNCELLEME)
// =========================================================================

function updateHesapIslemBilgi() {
    const secilen = getCustomVal('hi-hesap-secim');
    const infoKutu = document.getElementById('hi-mevcut-bilgi');
    if(!secilen || secilen.includes("Seçin")) { infoKutu.style.display = 'none'; return; }
    
    const hesap = window.currentStats.bankalar.find(b => b.isim === secilen);
    if(hesap) {
        document.getElementById('hi-mevcut-bakiye').innerHTML = formatTL(hesap.bakiye);
        document.getElementById('hi-mevcut-kmh').innerHTML = formatTL(hesap.limit);
        infoKutu.style.display = 'block';
        document.getElementById('hi-yeni-bakiye').value = '';
        document.getElementById('hi-yeni-kmh').value = '';
    } else {
        infoKutu.style.display = 'none';
    }
}

function toggleHesapIslemTab(tab) {
    vibe();
    document.getElementById('tab-hi-bakiye').style.display = tab === 'bakiye' ? 'block' : 'none';
    document.getElementById('tab-hi-kmh').style.display = tab === 'kmh' ? 'block' : 'none';
    document.getElementById('btn-hi-bakiye').classList.toggle('active', tab === 'bakiye');
    document.getElementById('btn-hi-kmh').classList.toggle('active', tab === 'kmh');
}

function submitBakiyeDuzelt() {
    const hesap = getCustomVal('hi-hesap-secim');
    const yeniTutarStr = document.getElementById('hi-yeni-bakiye').value;
    
    if(!hesap || hesap.includes("Seçin")) return markError('hi-hesap-secim');
    if(yeniTutarStr === "") return markError('hi-yeni-bakiye');
    
    const yeniTutar = parseSaha(yeniTutarStr);
    
    apiIstekAt({ 
        action: "hesap_bakiyesi_duzelt", 
        hesap_adi: hesap, 
        yeni_tutar: yeniTutar 
    }, 'btn-submit-bakiye-duzelt');
}

function submitKMHGuncelle() {
    const hesap = getCustomVal('hi-hesap-secim');
    const yeniLimitStr = document.getElementById('hi-yeni-kmh').value;
    
    if(!hesap || hesap.includes("Seçin")) return markError('hi-hesap-secim');
    if(yeniLimitStr === "") return markError('hi-yeni-kmh');
    
    const yeniLimit = parseSaha(yeniLimitStr);
    
    apiIstekAt({ 
        action: "kmh_limiti_guncelle", 
        hesap_adi: hesap, 
        yeni_limit: yeniLimit 
    }, 'btn-submit-kmh-guncelle');
}

function updateKartBorcIslemBilgi() {
    const secilen = getCustomVal('kbd-kart-secim');
    const infoKutu = document.getElementById('kbd-mevcut-bilgi');
    if(!secilen || secilen.includes("Seçin")) { infoKutu.style.display = 'none'; return; }
    
    const kart = window.currentStats.kartlarDetayli.find(k => k.isim === secilen);
    if(kart) {
        document.getElementById('kbd-mevcut-borc').innerHTML = formatTL(kart.borc);
        infoKutu.style.display = 'block';
    }
}

function submitKartBorcDuzelt() {
    const kart = getCustomVal('kbd-kart-secim');
    const yeniTutarStr = document.getElementById('kbd-yeni-borc').value;
    if(!kart || kart.includes("Seçin")) return markError('kbd-kart-secim');
    if(yeniTutarStr === "") return markError('hi-yeni-borc');
    
    apiIstekAt({ 
        action: "kart_bakiyesi_duzelt", 
        kart_adi: kart, 
        yeni_tutar: parseSaha(yeniTutarStr) 
    }, 'btn-submit-kart-borc-duzelt');
}

function updateTransferOptions() {
    const cikisEl = document.getElementById('t-cikis');
    const girisEl = document.getElementById('t-giris');
    if(!cikisEl || !girisEl) return;

    const seciliCikis = cikisEl.value; 
    const seciliGiris = girisEl.value;
    
    const tempDiv = document.createElement('div'); 
    tempDiv.innerHTML = window.vadesizOptions;
    const tumSecenekler = Array.from(tempDiv.querySelectorAll('option')).filter(o => o.value !== "");
    
    let yeniCikisHTML = `<option value="">Seçiniz...</option>`;
    tumSecenekler.forEach(opt => { 
        if (opt.value !== seciliGiris) { 
            yeniCikisHTML += `<option value="${opt.value}" ${opt.value === seciliCikis ? 'selected' : ''}>${opt.text}</option>`; 
        } 
    });
    cikisEl.innerHTML = yeniCikisHTML; 
    refreshCustomSelect(cikisEl);
    
    let yeniGirisHTML = `<option value="">Seçiniz...</option>`;
    tumSecenekler.forEach(opt => { 
        if (opt.value !== seciliCikis) { 
            yeniGirisHTML += `<option value="${opt.value}" ${opt.value === seciliGiris ? 'selected' : ''}>${opt.text}</option>`; 
        } 
    });
    girisEl.innerHTML = yeniGirisHTML; 
    refreshCustomSelect(girisEl);
}

async function submitTransfer() {
    const tutarStr = document.getElementById('t-tutar').value;
    const cikis = getCustomVal('t-cikis');
    const giris = getCustomVal('t-giris');
    const tarih = document.getElementById('t-tarih').value;

    let err = false;
    // Validasyonlar
    if (!tutarStr || parseSaha(tutarStr) <= 0) { markError('t-tutar'); err = true; }
    if (!cikis || cikis.includes("Seçin")) { markError('t-cikis'); err = true; }
    if (!giris || giris.includes("Seçin")) { markError('t-giris'); err = true; }
    if (!tarih) { markError('t-tarih'); err = true; }

    if (err) return;

    // Tarih formatlama (dd.MM.yyyy HH:mm)
    const simdi = new Date();
    const tParca = tarih.split('-');
    const tamTarih = `${tParca[2]}.${tParca[1]}.${tParca[0]} ${String(simdi.getHours()).padStart(2, '0')}:${String(simdi.getMinutes()).padStart(2, '0')}`;

    // Backend'e gönderim
    apiIstekAt({
        action: "transfer_yap",
        yontem: cikis,         // Çıkan Hesap
        transfer_yeri: giris,  // Giren Hesap
        tutar: parseSaha(tutarStr),
        tarih: tamTarih
    }, 'btn-submit-transfer');
}

    window.onload = () => { verileriCek(); };

// --- SADECE İSTENEN LİSTELERİ DÜZELTEN NOKTA ATIŞI KOD ---
    setTimeout(function() {
        // Sadece senin düzeltilmesini istediğin kutuların ID'leri:
        const hedefler = [
            'yh-tur',
            'kbo-odeme-sekli',
            'kredi-secim',
            'kredi-odeme-sekli',
            'kredi-yeni-hesap',
            'ozel-secim',
            'ozel-odeme-sekli',
            'ozel-guncelle-secim',
            'hi-hesap-secim',
            'kbd-kart-secim',
            't-cikis',
            't-giris'
        ];

        hedefler.forEach(function(id) {
            const kutu = document.getElementById(id);
            // Kutu bulunduysa siyah premium makyajı giydir
            if (kutu && typeof refreshCustomSelect === 'function') {
                refreshCustomSelect(kutu);
            }
        });
    }, 500); // PWA ekranı tam çizdikten yarım saniye sonra sessizce çalışır

function triggerFaizOde(btn) {
    btn.style.pointerEvents = 'none';
    const oldText = btn.innerHTML;
    btn.innerHTML = '<div class="premium-loader"><span></span><span></span><span></span></div>';

    setTimeout(() => {
        if(!document.getElementById('action-modal').classList.contains('active')) toggleModal();
        showSection('section-anlik', '⚡ Anlık Harcama / Gelir');
        
        // Gider Segmentini Tetikle
        const segmentBtns = document.querySelectorAll('#anlik-segment .segment-btn');
        if(segmentBtns.length > 0) setAnlikFilter('Gider', segmentBtns[0]);

        // Banka Faizi Kategorisini Bul ve Seç
        setTimeout(() => {
            const katEl = document.getElementById('an-kalem');
            if(katEl) {
                for (let i = 0; i < katEl.options.length; i++) {
                    if (katEl.options[i].text.includes("Faiz")) {
                        katEl.selectedIndex = i;
                        break;
                    }
                }
                if(typeof refreshCustomSelect === 'function') refreshCustomSelect(katEl);
                if(typeof checkAnlikKalem === 'function') checkAnlikKalem();
            }
            btn.innerHTML = oldText;
            btn.style.pointerEvents = 'auto';
        }, 400);
    }, 500);
}

function getKalanAyBadge(kalan) {
    if (kalan === undefined || kalan === null || kalan === "-" || kalan === "" || kalan === 0 || kalan === "0") return "";
    
    let text = "";
    let bgColor, textColor;

    if (kalan === "Süresiz") {
        text = "Süresiz";
        bgColor = "rgba(148, 163, 184, 0.12)"; // Gri
        textColor = "#94a3b8";
    } else {
        let n = parseInt(kalan);
        if (isNaN(n)) return "";
        text = `Kalan: ${n} Ay`;

        if (n <= 3) {
            bgColor = "rgba(16, 185, 129, 0.12)"; // Yeşil
            textColor = "var(--emerald)";
        } else if (n <= 6) {
            bgColor = "rgba(245, 158, 11, 0.12)"; // Turuncu
            textColor = "var(--amber)";
        } else {
            bgColor = "rgba(244, 63, 94, 0.12)"; // Kırmızı
            textColor = "var(--rose)";
        }
    }

    return `<span style="font-size:9px; background:${bgColor}; color:${textColor}; padding:2px 6px; border-radius:4px; margin-left:8px; font-weight:700; border:1px solid ${bgColor.replace('0.12', '0.25')}; white-space:nowrap; display:inline-flex; align-items:center; vertical-align:middle;">${text}</span>`;
}

function toggleParcaliAnlik() {
    const sekil = document.getElementById('an-odeme-sekli').value;
    const isParcali = (sekil === 'parcali');
    document.getElementById('an-tek-hesap-alani').style.display = isParcali ? 'none' : 'block';
    document.getElementById('an-parcali-hesap-alani').style.display = isParcali ? 'block' : 'none';
    if(isParcali) {
        document.getElementById('an-parcalar-container').innerHTML = '';
        addParcaAnlik(); addParcaAnlik();
        hesaplaKalanParcaliAnlik();
    }
}

function addParcaAnlik() {
    const container = document.getElementById('an-parcalar-container');
    // MİMAR DÜZELTMESİ: EKSİK UYARI EKLENDİ
    if(container.querySelectorAll('.parca-satiri-anlik').length >= 5) {
        alert("En fazla 5 farklı hesap ekleyebilirsiniz.");
        return;
    }
    
    const uniqueId = 'parca-an-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const options = (currentAnlikType === 'Gelir') ? window.vadesizOptions : window.hesapOptions;

    const row = document.createElement('div');
    row.className = 'parca-satiri-anlik';
    row.style.cssText = "display: grid; grid-template-columns: 1.5fr 1fr auto; gap: 8px; margin-bottom: 10px; align-items: start;";
    row.innerHTML = `
        <select id="${uniqueId}" class="form-control an-parca-hesap" style="padding: 10px; font-size: 13px;">${options}</select>
        <input type="text" inputmode="decimal" class="form-control an-parca-tutar" placeholder="Tutar" oninput="tutarFormatla(this); hesaplaKalanParcaliAnlik()" style="padding: 10px; font-size: 14px;">
        <button onclick="this.parentElement.remove(); hesaplaKalanParcaliAnlik();" style="background: rgba(244, 63, 94, 0.15); border: none; color: var(--rose); width: 38px; height: 38px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
    `;
    container.appendChild(row);
    
    // MİMAR DÜZELTMESİ: LİSTE KAPANMAMA VE ESKİ TASARIM SORUNU BURADA ÇÖZÜLÜYOR
    if(typeof refreshCustomSelect === 'function') {
        refreshCustomSelect(document.getElementById(uniqueId));
    }
}

function hesaplaKalanParcaliAnlik() {
    const anaTutarRaw = document.getElementById('an-tutar').value;
    const hedefTutar = parseSaha(anaTutarRaw) || 0;
    
    let girilenToplam = 0;
    document.querySelectorAll('.an-parca-tutar').forEach(inp => {
        girilenToplam += parseSaha(inp.value) || 0;
    });
    
    const kalan = hedefTutar - girilenToplam;
    
    // MİMAR DÜZELTMESİ: HTML içeriği koruyarak merkeze yazdırıyoruz
    document.getElementById('an-hedef-tutar').innerHTML = formatTL(hedefTutar);
    const kalanEl = document.getElementById('an-kalan-tutar');
    
    if (kalan === 0) {
        kalanEl.innerHTML = "₺0,00";
        kalanEl.style.color = "var(--emerald)";
    } else if (kalan < 0) {
        kalanEl.innerHTML = "Fazla: " + formatTL(Math.abs(kalan));
        kalanEl.style.color = "var(--rose)";
    } else {
        kalanEl.innerHTML = formatTL(kalan);
        kalanEl.style.color = "var(--amber)";
    }
}

function resetAnlikForm() {
    // 1. Yazı alanlarını temizle
    const inputlar = ['an-tutar', 'an-kalem-diger', 'an-ek-input'];
    inputlar.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });

    // 2. Checkbox'ı kapat ve ek alanları gizle
    const ekCheck = document.getElementById('an-ek-check');
    if(ekCheck) ekCheck.checked = false;
    
    const gizlenecekler = ['an-ek-input-konteyner', 'an-diger-konteyner', 'an-faiz-grubu', 'an-parcali-hesap-alani'];
    gizlenecekler.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = 'none';
    });

    // 3. Ödeme şeklini "Tek"e döndür ve görünürlüğü ayarla
    const odemeSekli = document.getElementById('an-odeme-sekli');
    if(odemeSekli) {
        odemeSekli.value = 'tek';
        document.getElementById('an-tek-hesap-alani').style.display = 'block';
    }

    // 4. Parçalı ödeme konteynerini boşalt
    const parcaKapsayici = document.getElementById('an-parcalar-container');
    if(parcaKapsayici) parcaKapsayici.innerHTML = '';

    // 5. Tarihi bugüne çek
    document.getElementById('an-tarih').valueAsDate = new Date();

    // 6. PREMIUM MAKYAJ: Seçim kutularını (Custom Select) görsel olarak sıfırla
    // Bu kısım çok önemli, yoksa görsel olarak eski isimler kalır.
    const selects = ['an-kalem', 'an-odeme-sekli', 'an-yontem', 'an-faiz-detay'];
    selects.forEach(id => {
        const sel = document.getElementById(id);
        if(sel) {
            sel.selectedIndex = 0;
            if(typeof refreshCustomSelect === 'function') refreshCustomSelect(sel);
        }
    });
}

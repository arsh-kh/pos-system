const db = require('../db');

async function seedRealOrganization() {
    console.log('================================================================');
    console.log('🏛️ زیادکردنی داتای مارکێتی ڕاستەقینە (Real Organization Master Data)');
    console.log('================================================================');

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Categories
        const realCategories = [
            'شیرەمەنی و بەروبوومی ماڵ',
            'خواردنەوە و ئاو',
            'دانەوێڵە، برنج و ڕۆن',
            'پاککەرەوە و تەندروستی',
            'میوە و سەوزەی کێشانە',
            'پسکیت، شیرینی و کێک',
            'گۆشت و بەرهەمی پەلەوەر'
        ];

        const catMap = {};
        for (const catName of realCategories) {
            const [existing] = await conn.query('SELECT id FROM Categories WHERE name = ?', [catName]);
            if (existing.length > 0) {
                catMap[catName] = existing[0].id;
            } else {
                const [res] = await conn.query('INSERT INTO Categories (name) VALUES (?)', [catName]);
                catMap[catName] = res.insertId;
                console.log(`✓ پۆل زیادکرا: ${catName} (ID: ${res.insertId})`);
            }
        }

        // 2. Suppliers
        const realSuppliers = [
            { name: 'کۆمپانیای دڵخۆش بۆ خۆراک و هاوردە', phone: '07501234567' },
            { name: 'کۆمپانیای کاروان بۆ بەرهەمە شیرەمەنییەکان', phone: '07509876543' },
            { name: 'کۆمپانیای زۆزان بۆ پاککەرەوە و تەندروستی', phone: '07705556677' },
            { name: 'کۆمپانیای بەرهەمی کوردستان بۆ میوە و سەوزە', phone: '07701112233' }
        ];

        const suppMap = {};
        for (const supp of realSuppliers) {
            const [existing] = await conn.query('SELECT id FROM Suppliers WHERE name = ?', [supp.name]);
            if (existing.length > 0) {
                suppMap[supp.name] = existing[0].id;
            } else {
                const [res] = await conn.query('INSERT INTO Suppliers (name, phone, total_paid, total_remaining) VALUES (?, ?, 0, 0)', [supp.name, supp.phone]);
                suppMap[supp.name] = res.insertId;
                console.log(`✓ دابینکەر زیادکرا: ${supp.name} (ID: ${res.insertId})`);
            }
        }

        // 3. Customers
        const realCustomers = [
            { name: 'کاک هێمن ئەحمەد - مارکێتی ئازادی', phone: '07501114477', notes: 'کڕیاری جوملە و تاک' },
            { name: 'مام ڕەسوڵ کەریم بەقاڵ', phone: '07702223344', notes: 'کڕیاری سەوزە و میوە' },
            { name: 'دکتۆر ڕێبوار ساڵح', phone: '07503335566', notes: 'کڕیاری دەوامی ئێواران - مامەڵەی قەرز' },
            { name: 'خاتوو شلێر محەمەد', phone: '07708889900', notes: 'کڕیاری هەفتانە' },
            { name: 'ئاسۆ فارووق عەلی', phone: '07507771122', notes: 'کڕیاری VIP' }
        ];

        const custMap = {};
        for (const cust of realCustomers) {
            const [existing] = await conn.query('SELECT id FROM Customers WHERE name = ?', [cust.name]);
            if (existing.length > 0) {
                custMap[cust.name] = existing[0].id;
            } else {
                const [res] = await conn.query('INSERT INTO Customers (name, phone, notes) VALUES (?, ?, ?)', [cust.name, cust.phone, cust.notes]);
                custMap[cust.name] = res.insertId;
                console.log(`✓ کڕیار زیادکرا: ${cust.name} (ID: ${res.insertId})`);
            }
        }

        // 4. Real Products
        const realProducts = [
            {
                name: 'برنجی مەحموود ١٠ کگم نایاب',
                barcode: '8690504123456',
                box_barcode: 'BOX8690504123456',
                units_per_box: 4,
                cost_price: 21000,
                selling_price: 25000,
                wholesale_price: 24000,
                stock: 120,
                category: 'دانەوێڵە، برنج و ڕۆن',
                is_weighted: 0,
                batch_number: 'BATCH-BR-2026-01',
                expiry_date: '2028-12-31'
            },
            {
                name: 'زەیتی زەیتوون سڤلیا ١ لیتر',
                barcode: '8690123456789',
                box_barcode: 'BOX8690123456789',
                units_per_box: 12,
                cost_price: 6500,
                selling_price: 8500,
                wholesale_price: 8000,
                stock: 144,
                category: 'دانەوێڵە، برنج و ڕۆن',
                is_weighted: 0,
                batch_number: 'BATCH-OIL-2026-01',
                expiry_date: '2027-06-30'
            },
            {
                name: 'ماستی کالی ١ کگم سوور',
                barcode: '6260123456001',
                box_barcode: 'BOX6260123456001',
                units_per_box: 6,
                cost_price: 1800,
                selling_price: 2500,
                wholesale_price: 2250,
                stock: 60,
                category: 'شیرەمەنی و بەروبوومی ماڵ',
                is_weighted: 0,
                batch_number: 'BATCH-YOG-2026-02',
                expiry_date: '2026-12-15'
            },
            {
                name: 'شیری ئەلپڕۆ بادەم ١ لیتر',
                barcode: '5411188110927',
                box_barcode: 'BOX5411188110927',
                units_per_box: 8,
                cost_price: 3200,
                selling_price: 4500,
                wholesale_price: 4000,
                stock: 80,
                category: 'شیرەمەنی و بەروبوومی ماڵ',
                is_weighted: 0,
                batch_number: 'BATCH-MLK-2026-01',
                expiry_date: '2027-04-10'
            },
            {
                name: 'تەماتەی کێشانە (کیلۆ)',
                barcode: '2000010000000',
                box_barcode: null,
                units_per_box: 1,
                cost_price: 650,
                selling_price: 1000,
                wholesale_price: 900,
                stock: 500,
                category: 'میوە و سەوزەی کێشانە',
                is_weighted: 1,
                batch_number: 'BATCH-TOM-2026-01',
                expiry_date: '2026-11-10'
            },
            {
                name: 'سێوی سووری کێشانە (کیلۆ)',
                barcode: '2000020000000',
                box_barcode: null,
                units_per_box: 1,
                cost_price: 1000,
                selling_price: 1500,
                wholesale_price: 1350,
                stock: 350,
                category: 'میوە و سەوزەی کێشانە',
                is_weighted: 1,
                batch_number: 'BATCH-APL-2026-01',
                expiry_date: '2026-11-20'
            },
            {
                name: 'تایدی ئاریەل ٣ کگم ئۆتۆماتیک',
                barcode: '4015600854123',
                box_barcode: 'BOX4015600854123',
                units_per_box: 4,
                cost_price: 8500,
                selling_price: 11000,
                wholesale_price: 10250,
                stock: 80,
                category: 'پاککەرەوە و تەندروستی',
                is_weighted: 0,
                batch_number: 'BATCH-ARI-2026-01',
                expiry_date: '2029-01-01'
            },
            {
                name: 'زاهی فەیری ١ لیتر لیمۆ',
                barcode: '5410076543210',
                box_barcode: 'BOX5410076543210',
                units_per_box: 16,
                cost_price: 2000,
                selling_price: 2750,
                wholesale_price: 2500,
                stock: 160,
                category: 'پاککەرەوە و تەندروستی',
                is_weighted: 0,
                batch_number: 'BATCH-FAY-2026-01',
                expiry_date: '2028-05-15'
            },
            {
                name: 'ئاوی کانی زوڵاڵ پاکێجی گەورە (١٢ دانە)',
                barcode: '4710123456789',
                box_barcode: null,
                units_per_box: 1,
                cost_price: 2500,
                selling_price: 3500,
                wholesale_price: 3000,
                stock: 200,
                category: 'خواردنەوە و ئاو',
                is_weighted: 0,
                batch_number: 'BATCH-WTR-2026-01',
                expiry_date: '2027-10-01'
            },
            {
                name: 'پسکیتی لۆتۆس ٢٥٠ گم بەناوبانگ',
                barcode: '5410126006789',
                box_barcode: 'BOX5410126006789',
                units_per_box: 20,
                cost_price: 2200,
                selling_price: 3000,
                wholesale_price: 2750,
                stock: 100,
                category: 'پسکیت، شیرینی و کێک',
                is_weighted: 0,
                batch_number: 'BATCH-LOT-2026-01',
                expiry_date: '2027-08-20'
            },
            {
                name: 'شوکۆلاتەی نۆتێلا ٧٥٠ گم ئەسڵی',
                barcode: '8000500179863',
                box_barcode: 'BOX8000500179863',
                units_per_box: 6,
                cost_price: 7500,
                selling_price: 9500,
                wholesale_price: 9000,
                stock: 72,
                category: 'پسکیت، شیرینی و کێک',
                is_weighted: 0,
                batch_number: 'BATCH-NUT-2026-01',
                expiry_date: '2027-07-15'
            },
            {
                name: 'پەنیری قەشقەوان کالی ٣٥٠ گم',
                barcode: '6260123456099',
                box_barcode: 'BOX6260123456099',
                units_per_box: 10,
                cost_price: 3000,
                selling_price: 4000,
                wholesale_price: 3600,
                stock: 90,
                category: 'شیرەمەنی و بەروبوومی ماڵ',
                is_weighted: 0,
                batch_number: 'BATCH-KASH-2026-01',
                expiry_date: '2027-01-25'
            }
        ];

        for (const p of realProducts) {
            const catId = catMap[p.category] || null;
            const [existProd] = await conn.query('SELECT id FROM Products WHERE barcode = ?', [p.barcode]);
            let prodId;
            if (existProd.length > 0) {
                prodId = existProd[0].id;
                await conn.query(`
                    UPDATE Products SET
                        name = ?, box_barcode = ?, units_per_box = ?, cost_price = ?,
                        selling_price = ?, wholesale_price = ?, stock = ?, category_id = ?, is_weighted = ?
                    WHERE id = ?
                `, [p.name, p.box_barcode, p.units_per_box, p.cost_price, p.selling_price, p.wholesale_price, p.stock, catId, p.is_weighted, prodId]);
                console.log(`✓ کاڵا نوێکرایەوە: ${p.name} (ID: ${prodId})`);
            } else {
                const [ins] = await conn.query(`
                    INSERT INTO Products (
                        name, barcode, box_barcode, units_per_box, cost_price,
                        selling_price, wholesale_price, stock, category_id, is_weighted, low_stock_threshold
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 10)
                `, [p.name, p.barcode, p.box_barcode, p.units_per_box, p.cost_price, p.selling_price, p.wholesale_price, p.stock, catId, p.is_weighted]);
                prodId = ins.insertId;
                console.log(`✓ کاڵای نوێ زیادکرا: ${p.name} (ID: ${prodId}, Barcode: ${p.barcode})`);
            }

            // Ensure active FIFO batch exists
            const [existBatch] = await conn.query('SELECT id FROM Product_Batches WHERE product_id = ? AND batch_number = ?', [prodId, p.batch_number]);
            if (existBatch.length === 0) {
                await conn.query(`
                    INSERT INTO Product_Batches (
                        product_id, batch_number, initial_quantity, remaining_quantity,
                        cost_price, selling_price, units_per_box, expiry_date, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
                `, [prodId, p.batch_number, p.stock, p.stock, p.cost_price, p.selling_price, p.units_per_box, p.expiry_date]);
                console.log(`  ↪ وەجبەی FIFO زیادکرا: ${p.batch_number}, بڕ: ${p.stock}`);
            }
        }

        await conn.commit();
        console.log('\n✅ تەواوی داتاکانی ڕێکخراو و مارکێتی ڕاستەقینە بە سەرکەوتوویی تۆمار کران!');
    } catch (err) {
        await conn.rollback();
        console.error('❌ هەڵە لە زیادکردنی داتای ڕێکخراو:', err);
        throw err;
    } finally {
        conn.release();
    }
}

if (require.main === module) {
    seedRealOrganization()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = seedRealOrganization;


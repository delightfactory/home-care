-- جدول الأدوار
CREATE TABLE roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    name_ar VARCHAR(100) NOT NULL,
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إدراج الأدوار الأساسية
INSERT INTO roles (name, name_ar, permissions) VALUES
('manager', 'المدير العام', '{"all": true}'),
('operations_supervisor', 'مشرف العمليات', '{"orders": true, "teams": true, "reports": true, "expenses_limit": 500}'),
('receptionist', 'موظف الاستقبال', '{"customers": true, "orders": true, "invoices": true}'),
('team_leader', 'قائد الفريق', '{"team_orders": true, "expenses": true, "order_status": true}');

-- جدول المستخدمين (يربط مع Supabase Auth)
CREATE TABLE users (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    role_id UUID REFERENCES roles(id),
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- جدول العملاء
CREATE TABLE customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address TEXT NOT NULL,
    area VARCHAR(100),
    location_coordinates POINT,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- فهرس للبحث السريع
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_area ON customers(area);


-- جدول فئات الخدمات
CREATE TABLE service_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    name_ar VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول الخدمات
CREATE TABLE services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id UUID REFERENCES service_categories(id),
    name VARCHAR(100) NOT NULL,
    name_ar VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    unit VARCHAR(50) DEFAULT 'service', -- service, hour, room, sqm
    estimated_duration INTEGER, -- بالدقائق
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إدراج فئات الخدمات الأساسية
INSERT INTO service_categories (name, name_ar) VALUES
('general_cleaning', 'تنظيف عام'),
('deep_cleaning', 'تنظيف عميق'),
('specialized_cleaning', 'تنظيف متخصص');



-- جدول العمال
CREATE TABLE workers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) UNIQUE,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    hire_date DATE NOT NULL,
    salary DECIMAL(10,2),
    skills JSONB DEFAULT '[]', -- مصفوفة المهارات
    can_drive BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'active', -- active, inactive, vacation
    rating DECIMAL(3,2) DEFAULT 0.00,
    total_orders INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول الفرق
CREATE TABLE teams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    leader_id UUID REFERENCES workers(id),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول أعضاء الفرق
CREATE TABLE team_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    worker_id UUID REFERENCES workers(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, worker_id)
);



-- جدول الطلبات
CREATE TABLE orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_number VARCHAR(20) UNIQUE NOT NULL,
    customer_id UUID REFERENCES customers(id) NOT NULL,
    team_id UUID REFERENCES teams(id),
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, scheduled, in_progress, completed, cancelled
    total_amount DECIMAL(10,2) DEFAULT 0.00,
    transport_method VARCHAR(50), -- company_car, taxi, uber, public_transport
    transport_cost DECIMAL(10,2) DEFAULT 0.00,
    payment_status VARCHAR(20) DEFAULT 'unpaid', -- paid_cash, paid_card, unpaid
    payment_method VARCHAR(20), -- cash, card
    notes TEXT,
    customer_rating INTEGER CHECK (customer_rating >= 1 AND customer_rating <= 5),
    customer_feedback TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول تفاصيل الطلبات (الخدمات المطلوبة)
CREATE TABLE order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id),
    quantity DECIMAL(10,2) DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    notes TEXT
);

-- جدول حالات الطلب (تتبع التقدم)
CREATE TABLE order_status_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL,
    notes TEXT,
    location_coordinates POINT,
    images JSONB DEFAULT '[]', -- مصفوفة روابط الصور
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- فهارس للأداء
CREATE INDEX idx_orders_date ON orders(scheduled_date);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_customer ON orders(customer_id);


-- جدول خطوط السير
CREATE TABLE routes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    team_id UUID REFERENCES teams(id),
    start_time TIME,
    estimated_end_time TIME,
    actual_start_time TIMESTAMP WITH TIME ZONE,
    actual_end_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'planned', -- planned, in_progress, completed
    total_distance DECIMAL(10,2), -- بالكيلومتر
    total_estimated_time INTEGER, -- بالدقائق
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول طلبات خط السير (ترتيب الطلبات)
CREATE TABLE route_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    sequence_order INTEGER NOT NULL,
    estimated_arrival_time TIME,
    actual_arrival_time TIMESTAMP WITH TIME ZONE,
    estimated_completion_time TIME,
    actual_completion_time TIMESTAMP WITH TIME ZONE,
    UNIQUE(route_id, order_id),
    UNIQUE(route_id, sequence_order)
);




-- جدول فئات المصروفات
CREATE TABLE expense_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    name_ar VARCHAR(100) NOT NULL,
    description TEXT,
    requires_approval BOOLEAN DEFAULT false,
    approval_limit DECIMAL(10,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول المصروفات
CREATE TABLE expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id UUID REFERENCES expense_categories(id),
    order_id UUID REFERENCES orders(id), -- اختياري - ربط بطلب معين
    route_id UUID REFERENCES routes(id), -- اختياري - ربط بخط سير
    team_id UUID REFERENCES teams(id),
    amount DECIMAL(10,2) NOT NULL,
    description TEXT NOT NULL,
    receipt_image_url TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إدراج فئات المصروفات الأساسية
INSERT INTO expense_categories (name, name_ar, requires_approval, approval_limit) VALUES
('fuel', 'وقود', false, 100.00),
('transport', 'مواصلات', false, 50.00),
('materials', 'مواد تنظيف', true, 200.00),
('maintenance', 'صيانة', true, 500.00),
('other', 'أخرى', true, 100.00);



-- جدول التقارير اليومية
CREATE TABLE daily_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    report_date DATE NOT NULL UNIQUE,
    total_orders INTEGER DEFAULT 0,
    completed_orders INTEGER DEFAULT 0,
    cancelled_orders INTEGER DEFAULT 0,
    total_revenue DECIMAL(10,2) DEFAULT 0.00,
    total_expenses DECIMAL(10,2) DEFAULT 0.00,
    net_profit DECIMAL(10,2) DEFAULT 0.00,
    active_teams INTEGER DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    generated_by UUID REFERENCES users(id)
);

-- جدول إحصائيات الفرق
CREATE TABLE team_performance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id UUID REFERENCES teams(id),
    date DATE NOT NULL,
    orders_completed INTEGER DEFAULT 0,
    total_revenue DECIMAL(10,2) DEFAULT 0.00,
    total_expenses DECIMAL(10,2) DEFAULT 0.00,
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    efficiency_score DECIMAL(5,2) DEFAULT 0.00, -- نسبة الإنجاز في الوقت المحدد
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, date)
);


-- جدول إعدادات النظام
CREATE TABLE system_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key VARCHAR(100) NOT NULL UNIQUE,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إدراج الإعدادات الأساسية
INSERT INTO system_settings (key, value, description) VALUES
('transport_rates', '{"company_car": 0.5, "taxi": 2.0, "uber": 1.8, "public_transport": 0.3}', 'تكلفة المواصلات لكل كيلومتر'),
('working_hours', '{"start": "08:00", "end": "18:00"}', 'ساعات العمل'),
('order_number_prefix', '"ORD"', 'بادئة رقم الطلب'),
('company_info', '{"name": "شركة HOME CARE", "phone": "", "address": ""}', 'معلومات الشركة');


-- تفعيل Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- سياسة الوصول للمستخدمين
CREATE POLICY "Users can view their own data" ON users
    FOR ALL USING (auth.uid() = id);

-- سياسة الوصول للعملاء (حسب الدور)
CREATE POLICY "Authenticated users can view customers" ON customers
    FOR SELECT USING (auth.role() = 'authenticated');

-- سياسة الوصول للطلبات
CREATE POLICY "Users can view orders based on role" ON orders
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users u 
            JOIN roles r ON u.role_id = r.id 
            WHERE u.id = auth.uid() 
            AND (r.name = 'manager' OR r.name = 'operations_supervisor' OR r.name = 'receptionist')
        )
    );


    

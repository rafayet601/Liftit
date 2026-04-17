mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS liftit;"

-- Users table (OAuth)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    provider VARCHAR(20) NOT NULL,
    provider_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_provider (provider, provider_id)
);

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) UNIQUE NOT NULL,
    level VARCHAR(20) DEFAULT 'Intermediate',
    goals TEXT,
    experience INT DEFAULT 0,
    preferred_units VARCHAR(10) DEFAULT 'kg',
    injuries TEXT,
    equipment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Exercises table
CREATE TABLE IF NOT EXISTS exercises (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    muscle_group VARCHAR(50) NOT NULL,
    equipment VARCHAR(100),
    instructions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Workout logs table
CREATE TABLE IF NOT EXISTS workout_logs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    date DATE NOT NULL,
    name VARCHAR(255),
    duration INT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Workout sets table
CREATE TABLE IF NOT EXISTS workout_sets (
    id VARCHAR(36) PRIMARY KEY,
    workout_log_id VARCHAR(36) NOT NULL,
    exercise_id VARCHAR(36) NOT NULL,
    set_number INT NOT NULL,
    weight DECIMAL(10,2),
    reps INT,
    rpe DECIMAL(3,1),
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workout_log_id) REFERENCES workout_logs(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
);

-- Programs table
CREATE TABLE IF NOT EXISTS programs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    duration_weeks INT NOT NULL,
    days_per_week INT NOT NULL,
    focus VARCHAR(50),
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Program days table
CREATE TABLE IF NOT EXISTS program_days (
    id VARCHAR(36) PRIMARY KEY,
    program_id VARCHAR(36) NOT NULL,
    day_number INT NOT NULL,
    name VARCHAR(255),
    exercises JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE
);

-- Mesocycles table
CREATE TABLE IF NOT EXISTS mesocycles (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    program_id VARCHAR(36),
    name VARCHAR(255) NOT NULL,
    start_date DATE,
    end_date DATE,
    current_week INT DEFAULT 1,
    weeks INT NOT NULL,
    days_per_week INT NOT NULL,
    focus VARCHAR(50),
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL
);

-- Progression rules table
CREATE TABLE IF NOT EXISTS progression_rules (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    exercise_id VARCHAR(36) NOT NULL,
    current_weight DECIMAL(10,2),
    target_reps INT,
    rep_range_min INT,
    rep_range_max INT,
    last_increased_at DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_workout_logs_user ON workout_logs(user_id);
CREATE INDEX idx_workout_logs_date ON workout_logs(date);
CREATE INDEX idx_workout_sets_workout ON workout_sets(workout_log_id);
CREATE INDEX idx_workout_sets_exercise ON workout_sets(exercise_id);
CREATE INDEX idx_exercises_muscle ON exercises(muscle_group);
CREATE INDEX idx_programs_user ON programs(user_id);
CREATE INDEX idx_progression_rules_user ON progression_rules(user_id);

-- Seed data
INSERT INTO exercises (id, name, muscle_group, equipment, instructions) VALUES
('ex-001', 'Barbell Bench Press', 'chest', 'barbell', 'Lie on bench, grip barbell slightly wider than shoulder width, lower to chest, press up'),
('ex-002', 'Incline Dumbbell Press', 'chest', 'dumbbells', 'Set bench to 30-45 degrees, press dumbbells up from shoulders'),
('ex-003', 'Barbell Back Squat', 'legs', 'barbell', 'Bar on upper back, squat down until thighs parallel, stand up'),
('ex-004', 'Romanian Deadlift', 'legs', 'barbell', 'Hinge at hips with slight knee bend, lower bar along legs'),
('ex-005', 'Pull-ups', 'back', 'bodyweight', 'Hang from bar, pull up until chin over bar, lower controlled'),
('ex-006', 'Barbell Row', 'back', 'barbell', 'Bend over, row barbell to lower chest'),
('ex-007', 'Overhead Press', 'shoulders', 'barbell', 'Press barbell from shoulders to overhead'),
('ex-008', 'Lateral Raises', 'shoulders', 'dumbbells', 'Raise dumbbells to sides until parallel to floor'),
('ex-009', 'Barbell Curl', 'biceps', 'barbell', 'Curl barbell up, squeeze biceps, lower controlled'),
('ex-010', 'Tricep Pushdown', 'triceps', 'cable', 'Push cable down until arms straight, control return'),
('ex-011', 'Leg Press', 'legs', 'machine', 'Press platform away, control descent'),
('ex-012', 'Leg Curl', 'legs', 'machine', 'Curl weight toward glutes, control return'),
('ex-013', 'Leg Extension', 'legs', 'machine', 'Extend legs until straight, control return'),
('ex-014', 'Lat Pulldown', 'back', 'cable', 'Pull bar down to upper chest, control return'),
('ex-015', 'Face Pulls', 'shoulders', 'cable', 'Pull rope to face, separate hands at end'),
('ex-016', 'Dumbbell Lunges', 'legs', 'dumbbells', 'Step forward into lunge, alternate legs'),
('ex-017', 'Cable Fly', 'chest', 'cable', 'Bring handles together in arc motion'),
('ex-018', 'Hammer Curls', 'biceps', 'dumbbells', 'Curl with neutral grip, alternate arms'),
('ex-019', 'Skull Crushers', 'triceps', 'barbell', 'Lower bar to forehead, extend arms'),
('ex-020', 'Calf Raises', 'legs', 'machine', 'Rise onto toes, control descent');

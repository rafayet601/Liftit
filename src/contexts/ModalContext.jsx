import React, { createContext, useContext, useState, useCallback } from 'react';

const ModalContext = createContext({
    showTrainer: false,
    showProgramGenerator: false,
    openTrainer: () => {},
    closeTrainer: () => {},
    openProgramGenerator: () => {},
    closeProgramGenerator: () => {},
    toggleTrainer: () => {},
});

export const useModal = () => useContext(ModalContext);

export function ModalProvider({ children }) {
    const [showTrainer, setShowTrainer] = useState(false);
    const [showProgramGenerator, setShowProgramGenerator] = useState(false);

    const openTrainer = useCallback(() => {
        setShowTrainer(true);
        setShowProgramGenerator(false);
    }, []);

    const closeTrainer = useCallback(() => {
        setShowTrainer(false);
    }, []);

    const openProgramGenerator = useCallback(() => {
        setShowProgramGenerator(true);
        setShowTrainer(false);
    }, []);

    const closeProgramGenerator = useCallback(() => {
        setShowProgramGenerator(false);
    }, []);

    const toggleTrainer = useCallback(() => {
        setShowTrainer(prev => !prev);
    }, []);

    const value = {
        showTrainer,
        showProgramGenerator,
        openTrainer,
        closeTrainer,
        openProgramGenerator,
        closeProgramGenerator,
        toggleTrainer,
    };

    return (
        <ModalContext.Provider value={value}>
            {children}
        </ModalContext.Provider>
    );
}

export default ModalContext;

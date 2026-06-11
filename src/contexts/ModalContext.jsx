import React, { createContext, useContext, useState, useCallback } from 'react';

const ModalContext = createContext({
    showTrainer: false,
    openTrainer: () => {},
    closeTrainer: () => {},
    toggleTrainer: () => {},
});

export const useModal = () => useContext(ModalContext);

export function ModalProvider({ children }) {
    const [showTrainer, setShowTrainer] = useState(false);

    const openTrainer = useCallback(() => setShowTrainer(true), []);
    const closeTrainer = useCallback(() => setShowTrainer(false), []);
    const toggleTrainer = useCallback(() => setShowTrainer((prev) => !prev), []);

    return (
        <ModalContext.Provider value={{ showTrainer, openTrainer, closeTrainer, toggleTrainer }}>
            {children}
        </ModalContext.Provider>
    );
}

export default ModalContext;

import { createContext } from 'react';

type PageState = {
    title: string
}

function PageStateReducer(state: PageState, action: any) {
    switch (action.type) {
        case 'SET_TITLE':
            return { ...state, title: action.title };
        default:
            return state;
    }
}

import type { Region } from '../types/models';

export interface AppState {
  selectedRegion: Region | null;
}

type Listener = (state: AppState) => void;

class Store {
  private state: AppState = { selectedRegion: null };
  private listeners = new Set<Listener>();

  getState(): AppState {
    return this.state;
  }

  setSelectedRegion(region: Region | null): void {
    this.state = { ...this.state, selectedRegion: region };
    this.listeners.forEach((l) => l(this.state));
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const store = new Store();
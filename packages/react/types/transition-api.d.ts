interface Document {
	readonly startViewTransition: StartViewTransition;
}

interface StartViewTransition {
	(
		updateCallback:
			| ViewTransitionUpdateCallback
			| AsyncViewTransitionUpdateCallback
	): ViewTransition;
}

interface ViewTransitionUpdateCallback {
	(): void;
}

interface AsyncViewTransitionUpdateCallback {
	(): Promise<void>;
}

interface ViewTransition {
	readonly domUpdated: Promise<void>;
	readonly finished: Promise<void>;
	readonly ready: Promise<void>;
	skipTransition(): void;
}

"use client";
import { useNavigation } from "oneup/react.client";

export function GlobalLoadingIndicator() {
	const navigation = useNavigation();

	if (navigation.state === "loading") {
		return <p>Loading...</p>;
	}

	return null;
}

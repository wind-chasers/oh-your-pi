import fuzzysort from "fuzzysort";
import type { SkillDefinition } from "./model";

type FuzzySkillResult = {
	obj: SkillDefinition;
	score: number;
};

function normalize(value: string): string {
	return value.trim().normalize("NFKC").toLocaleLowerCase();
}

function toSkills(results: readonly FuzzySkillResult[]): SkillDefinition[] {
	return [...results]
		.sort((left, right) => right.score - left.score || left.obj.name.localeCompare(right.obj.name))
		.map(({ obj }) => obj);
}

function searchSkills(
	skills: readonly SkillDefinition[],
	query: string,
	key: (skill: SkillDefinition) => string,
): SkillDefinition[] {
	return toSkills(fuzzysort.go(query, skills, { key }));
}

export function filterSkills(
	skills: readonly SkillDefinition[],
	query: string,
): readonly SkillDefinition[] {
	const normalizedQuery = normalize(query);
	if (normalizedQuery === "") return [...skills].sort((left, right) => left.name.localeCompare(right.name));

	const nameMatches = searchSkills(skills, normalizedQuery, (skill) => normalize(skill.name));
	const matchedSkills = new Set(nameMatches);
	const descriptionMatches = searchSkills(
		skills.filter((skill) => !matchedSkills.has(skill)),
		normalizedQuery,
		(skill) => normalize(skill.description),
	);
	return [...nameMatches, ...descriptionMatches];
}

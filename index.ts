import { $ } from 'bun'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import type { components } from '@octokit/openapi-types'

class GithubApiError extends Error {
	constructor(status: number, statusText: string) {
		super(`GitHub API Response: ${status} ${statusText}`)
		this.name = 'GithubApiError'
	}
}

class GitCommandError extends Error {
	constructor(command: string, repo: string, error: unknown) {
		super(`Git '${command} failed for '${repo}': ${error}`)
		this.name = 'GitCommandError'
	}
}

type Repo = components['schemas']['repository']

type RepoInfo = {
	git_url: string | null
	default_branch: string | null
}

type GitConfig = {
	localRepoDir: string
	githubUser: string
	strategy: 'rebase' | 'merge'
}

const config: GitConfig = {
	localRepoDir: 'C:\\Users\\svora\\repositories\\',
	githubUser: 'alexsvorada',
	strategy: 'rebase',
}

async function _listRepos(): Promise<{
	remoteRepos: Map<string, RepoInfo>
	localRepos: Map<string, RepoInfo>
}> {
	try {
		const [remoteReposResponse, localRepos] = await Promise.all([
			fetch(`https://api.github.com/users/${config.githubUser}/repos`),
			readdir(config.localRepoDir),
		])

		if (!remoteReposResponse.ok) {
			throw new GithubApiError(remoteReposResponse.status, remoteReposResponse.statusText)
		}

		const remoteRepos = (await remoteReposResponse.json()) as Repo[]

		return {
			remoteRepos: new Map(
				remoteRepos.map((repo): [string, RepoInfo] => [
					repo.name,
					{
						git_url: repo.git_url,
						default_branch: repo.default_branch,
					},
				])
			),
			localRepos: new Map(
				localRepos.map((repoName): [string, RepoInfo] => [
					repoName,
					{
						git_url: null,
						default_branch: null,
					},
				])
			),
		}
	} catch (err) {
		if (err instanceof GithubApiError) {
			throw err
		}

		throw new Error(`Failed to list repositories: ${err}`)
	}
}

async function getReposByDifference(): Promise<{
	matchingRepos: Map<string, RepoInfo>
	missingOnLocalRepos: Map<string, RepoInfo>
	missingOnRemoteRepos: Map<string, RepoInfo>
}> {
	const { remoteRepos, localRepos } = await _listRepos()

	return {
		matchingRepos: new Map([...remoteRepos].filter(([k]) => localRepos.has(k))),
		missingOnLocalRepos: new Map([...remoteRepos].filter(([k]) => !localRepos.has(k))),
		missingOnRemoteRepos: new Map([...localRepos].filter(([k]) => !remoteRepos.has(k))),
	}
}

async function _cloneMissingRepos(): Promise<void> {
	const { missingOnLocalRepos } = await getReposByDifference()

	for (const [name, info] of missingOnLocalRepos) {
		try {
			console.log(`Cloning ${name}...`)
			await $`git clone ${info.git_url} ${config.localRepoDir}/${name}`
		} catch (err) {
			throw new GitCommandError('clone', name, err)
		}
	}
}

async function _pullMatchingRepos(): Promise<void> {
	const { matchingRepos } = await getReposByDifference()

	for (const [name] of matchingRepos) {
		try {
			const repoPath = path.join(config.localRepoDir, name)

			const hasChanges = (await $`git -C ${repoPath} status --porcelain`).toString().length > 0

			if (!hasChanges) {
				await $`git -C ${repoPath} pull --${config.strategy}`
				continue
			}

			await $`git -C ${repoPath} stash push -m "automated_backup_${_currentDate()}"`
			await $`git -C ${repoPath} pull --${config.strategy}`

			try {
				await $`git -C ${repoPath} stash pop`
			} catch {
				const stashRef = (await $`git -C ${repoPath} stash list`).toString().split('\n')[0].split(':')[0]
				await $`git -C ${repoPath} stash apply ${stashRef}`
				console.warn(`Stash conflicts ${name}. ` + `Changes preserved in ${stashRef}. Manual resolution required.`)
			}
		} catch (error) {
			throw new GitCommandError('pull', name, error)
		}
	}
}

function _currentDate(): string {
	return new Date().toISOString().split('T')[0].split('-').reverse().join('.')
}

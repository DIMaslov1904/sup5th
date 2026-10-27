export const needsApiAuthorization = (data, type) => ['login_required', 'authorization_needed'].includes(
    data?.[type === 'projects' ? 'projectApiStatus' : 'accessApiStatus']
) || (type === 'accesses' && data?.accessAuthRequired === true)
